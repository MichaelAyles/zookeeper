import { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../stores/useStore';
import { identifyAnimal, findAnimalByName } from '../services/identification';
import { addAISighting, getSightingsByVisit } from '../services/sightings';
import { getAnimalsByZoo } from '../services/animals';
import { categoryIcons } from '../lib/utils';
import { colors } from '../lib/colors';
import type { ZooAnimal } from '../types';
import BottomNav from '../components/BottomNav';

type CameraState = 'scanning' | 'identifying' | 'result' | 'error';

interface IdentifiedAnimal {
  animal: ZooAnimal;
  confidence: number;
  funFact?: string;
  isFirstSighting: boolean;
}

export default function Camera() {
  const navigate = useNavigate();
  const { activeVisit, activeZoo } = useStore();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraState, setCameraState] = useState<CameraState>('scanning');
  const [result, setResult] = useState<IdentifiedAnimal | null>(null);
  const [animals, setAnimals] = useState<ZooAnimal[]>([]);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    startCamera();
    loadAnimals();
    return () => stopCamera();
  }, []);

  async function loadAnimals() {
    if (!activeZoo) return;
    const zooAnimals = await getAnimalsByZoo(activeZoo.id);
    setAnimals(zooAnimals);
  }

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      setErrorMessage('Camera access denied');
      setCameraState('error');
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
  }

  async function captureAndIdentify() {
    if (!videoRef.current || !canvasRef.current || !activeVisit || !activeZoo) {
      if (!activeVisit) {
        setErrorMessage('Please start a zoo visit first');
        setCameraState('error');
      }
      return;
    }

    if (animals.length === 0) {
      setErrorMessage('No animals loaded for this zoo');
      setCameraState('error');
      return;
    }

    setCameraState('identifying');

    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    const imageData = canvas.toDataURL('image/jpeg', 0.8);
    setCapturedImage(imageData);

    try {
      const identification = await identifyAnimal(imageData, animals);

      if (!identification.animal) {
        setErrorMessage('Could not identify any animal in the image. Please try again.');
        setCameraState('error');
        return;
      }

      // Find the full animal object
      const matchedAnimal = findAnimalByName(identification.animal, animals);
      if (!matchedAnimal) {
        setErrorMessage('Animal not found in zoo database. Please try again.');
        setCameraState('error');
        return;
      }

      // Check if already sighted
      const existingSightings = await getSightingsByVisit(activeVisit.id);
      const alreadySpotted = existingSightings.some(s => s.animalId === matchedAnimal.id);

      setResult({
        animal: matchedAnimal,
        confidence: Math.round(identification.confidence * 100),
        funFact: identification.funFact || matchedAnimal.funFact,
        isFirstSighting: !alreadySpotted,
      });
      setCameraState('result');
    } catch (err) {
      setErrorMessage('Could not identify animal. Please try again.');
      setCameraState('error');
    }
  }

  async function handleAddToCollection() {
    if (!result?.animal || !activeVisit) return;

    await addAISighting(
      activeVisit.id,
      result.animal.id,
      result.confidence,
      capturedImage || undefined
    );

    navigate(`/visit/${activeVisit.id}`);
  }

  function handleTryAgain() {
    setResult(null);
    setErrorMessage('');
    setCapturedImage(null);
    setCameraState('scanning');
  }

  // Scanning / Camera view
  if (cameraState === 'scanning' || cameraState === 'identifying') {
    return (
      <div style={{
        height: '100vh',
        position: 'relative',
        background: '#1a1a1a',
      }}>
        {/* Video feed */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {/* Overlay gradient */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: `
            linear-gradient(180deg, rgba(45, 90, 61, 0.3) 0%, rgba(107, 142, 107, 0.2) 50%, rgba(139, 115, 85, 0.3) 100%)
          `,
          pointerEvents: 'none',
        }} />

        {/* Top bar */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          padding: '56px 20px 16px',
          background: 'linear-gradient(180deg, rgba(0,0,0,0.5) 0%, transparent 100%)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <button
            onClick={() => navigate('/')}
            style={{
              padding: '10px 16px',
              borderRadius: '12px',
              border: 'none',
              background: 'rgba(255,255,255,0.15)',
              backdropFilter: 'blur(10px)',
              color: '#fff',
              fontSize: '14px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
            }}
          >
            <span>📍</span> {activeZoo?.name || 'No Zoo'}
          </button>
          <button style={{
            width: '40px',
            height: '40px',
            borderRadius: '12px',
            border: 'none',
            background: 'rgba(255,255,255,0.15)',
            backdropFilter: 'blur(10px)',
            fontSize: '18px',
            cursor: 'pointer',
          }}>
            ⚡
          </button>
        </div>

        {/* Detection frame */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        }}>
          <div style={{
            width: '200px',
            height: '200px',
            position: 'relative',
          }}>
            {/* Corners */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '32px',
              height: '32px',
              borderTop: `3px solid ${colors.gold}`,
              borderLeft: `3px solid ${colors.gold}`,
              borderRadius: '4px',
            }} />
            <div style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: '32px',
              height: '32px',
              borderTop: `3px solid ${colors.gold}`,
              borderRight: `3px solid ${colors.gold}`,
              borderRadius: '4px',
            }} />
            <div style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              width: '32px',
              height: '32px',
              borderBottom: `3px solid ${colors.gold}`,
              borderLeft: `3px solid ${colors.gold}`,
              borderRadius: '4px',
            }} />
            <div style={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: '32px',
              height: '32px',
              borderBottom: `3px solid ${colors.gold}`,
              borderRight: `3px solid ${colors.gold}`,
              borderRadius: '4px',
            }} />

            {/* Scanning indicator */}
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
            }}>
              <div style={{
                padding: '10px 18px',
                background: 'rgba(0,0,0,0.6)',
                backdropFilter: 'blur(10px)',
                borderRadius: '12px',
                color: '#fff',
                fontSize: '14px',
                fontWeight: '600',
              }}>
                <span style={{ marginRight: '8px' }}>
                  {cameraState === 'identifying' ? '⏳' : '🔍'}
                </span>
                {cameraState === 'identifying' ? 'Identifying...' : 'Point at animal'}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom section */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '20px 20px 36px',
          background: 'linear-gradient(0deg, rgba(0,0,0,0.7) 0%, transparent 100%)',
        }}>
          {/* Recent strip */}
          <div style={{
            display: 'flex',
            gap: '10px',
            marginBottom: '20px',
            justifyContent: 'center',
          }}>
            {['🦒', '🐘', '🦓'].map((emoji, i) => (
              <div key={i} style={{
                width: '52px',
                height: '52px',
                borderRadius: '12px',
                background: 'rgba(255,255,255,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '26px',
              }}>
                {emoji}
              </div>
            ))}
            <div style={{
              width: '52px',
              height: '52px',
              borderRadius: '12px',
              background: 'rgba(255,255,255,0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'rgba(255,255,255,0.6)',
              fontSize: '13px',
              fontWeight: '600',
            }}>
              +30
            </div>
          </div>

          {/* Shutter controls */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
          }}>
            <button
              onClick={() => navigate('/')}
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '14px',
                border: 'none',
                background: 'rgba(255,255,255,0.15)',
                fontSize: '22px',
                cursor: 'pointer',
              }}
            >
              🏠
            </button>

            <button
              onClick={captureAndIdentify}
              disabled={cameraState === 'identifying' || !activeVisit}
              style={{
                width: '76px',
                height: '76px',
                borderRadius: '50%',
                border: '4px solid #fff',
                background: 'rgba(255,255,255,0.1)',
                cursor: cameraState === 'identifying' ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: !activeVisit ? 0.5 : 1,
              }}
            >
              <div style={{
                width: '58px',
                height: '58px',
                borderRadius: '50%',
                background: '#fff',
              }} />
            </button>

            <button style={{
              width: '48px',
              height: '48px',
              borderRadius: '14px',
              border: 'none',
              background: 'rgba(255,255,255,0.15)',
              fontSize: '22px',
              cursor: 'pointer',
            }}>
              🔄
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Result view
  if (cameraState === 'result' && result) {
    return (
      <div style={{
        height: '100vh',
        background: '#1a1a1a',
        position: 'relative',
      }}>
        {/* Photo background */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: `
            linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.95) 80%),
            linear-gradient(135deg, #C9A66B 0%, #8B7355 50%, #5A4A2F 100%)
          `,
        }}>
          <div style={{
            position: 'absolute',
            top: '22%',
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: '150px',
            opacity: 0.25,
          }}>
            {categoryIcons[result.animal.category]}
          </div>
        </div>

        {/* Success badge */}
        <div style={{
          position: 'absolute',
          top: '60px',
          left: '50%',
          transform: 'translateX(-50%)',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 20px',
            background: colors.forest,
            borderRadius: '14px',
            boxShadow: '0 8px 24px rgba(45, 90, 61, 0.4)',
          }}>
            <span style={{ fontSize: '18px' }}>✨</span>
            <span style={{
              fontSize: '15px',
              fontWeight: '700',
              color: '#fff',
            }}>
              Animal Identified!
            </span>
          </div>
        </div>

        {/* Result card */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          background: colors.cream,
          borderRadius: '28px 28px 0 0',
          padding: '28px 24px 40px',
        }}>
          {/* Animal info */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            marginBottom: '20px',
          }}>
            <div style={{
              width: '68px',
              height: '68px',
              background: `linear-gradient(135deg, ${colors.gold}30 0%, ${colors.terracotta}20 100%)`,
              borderRadius: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '36px',
            }}>
              {categoryIcons[result.animal.category]}
            </div>
            <div>
              <h2 style={{
                margin: 0,
                fontSize: '24px',
                fontWeight: '700',
                color: colors.text,
              }}>{result.animal.commonName}</h2>
              <p style={{
                margin: '4px 0 0',
                fontSize: '14px',
                color: colors.textMuted,
                fontStyle: 'italic',
              }}>{result.animal.scientificName}</p>
            </div>
          </div>

          {/* Tags */}
          <div style={{
            display: 'flex',
            gap: '8px',
            flexWrap: 'wrap',
            marginBottom: '20px',
          }}>
            <div style={{
              padding: '8px 14px',
              background: `${colors.forest}15`,
              borderRadius: '10px',
              color: colors.forest,
              fontSize: '13px',
              fontWeight: '600',
            }}>
              {result.confidence}% match
            </div>
            <div style={{
              padding: '8px 14px',
              background: colors.warmGray,
              borderRadius: '10px',
              color: colors.textMuted,
              fontSize: '13px',
              fontWeight: '600',
            }}>
              {categoryIcons[result.animal.category]} {result.animal.category}
            </div>
            {result.isFirstSighting && (
              <div style={{
                padding: '8px 14px',
                background: `${colors.gold}20`,
                borderRadius: '10px',
                color: colors.terracotta,
                fontSize: '13px',
                fontWeight: '600',
              }}>
                ⭐ First sighting!
              </div>
            )}
          </div>

          {/* Fun fact */}
          {result.funFact && (
            <div style={{
              padding: '16px',
              background: '#fff',
              borderRadius: '14px',
              borderLeft: `4px solid ${colors.gold}`,
              marginBottom: '24px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            }}>
              <p style={{
                margin: '0 0 6px',
                fontSize: '12px',
                fontWeight: '700',
                color: colors.gold,
                letterSpacing: '0.5px',
              }}>
                DID YOU KNOW?
              </p>
              <p style={{
                margin: 0,
                fontSize: '14px',
                color: colors.text,
                lineHeight: '1.5',
              }}>
                {result.funFact}
              </p>
            </div>
          )}

          {/* Actions */}
          <button
            onClick={handleAddToCollection}
            style={{
              width: '100%',
              padding: '16px',
              borderRadius: '14px',
              border: 'none',
              background: colors.forest,
              color: '#fff',
              fontSize: '16px',
              fontWeight: '700',
              cursor: 'pointer',
              marginBottom: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            Add to Collection ✓
          </button>
          <button
            onClick={handleTryAgain}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '12px',
              border: `2px solid ${colors.sand}`,
              background: 'transparent',
              color: colors.textMuted,
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            Not right? Try again
          </button>
        </div>
      </div>
    );
  }

  // Error view
  return (
    <div style={{
      height: '100vh',
      background: colors.cream,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
    }}>
      <span style={{ fontSize: '64px', marginBottom: '16px' }}>😕</span>
      <h2 style={{ margin: '0 0 8px', fontSize: '20px', fontWeight: '700', color: colors.text }}>
        Oops!
      </h2>
      <p style={{ margin: '0 0 24px', fontSize: '14px', color: colors.textMuted, textAlign: 'center' }}>
        {errorMessage || 'Something went wrong'}
      </p>
      <button
        onClick={handleTryAgain}
        style={{
          padding: '14px 32px',
          borderRadius: '12px',
          border: 'none',
          background: colors.forest,
          color: '#fff',
          fontSize: '16px',
          fontWeight: '700',
          cursor: 'pointer',
        }}
      >
        Try Again
      </button>
      <BottomNav active="spot" />
    </div>
  );
}
