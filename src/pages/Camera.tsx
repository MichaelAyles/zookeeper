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

type CameraState = 'scanning' | 'identifying' | 'result' | 'error' | 'funFail';

interface IdentifiedAnimal {
  animal: ZooAnimal;
  confidence: number;
  funFact?: string;
  isFirstSighting: boolean;
}

interface FunFail {
  emoji: string;
  message: string;
}

// Test images for test camera mode - mix of zoo animals, pets, objects, and colors
const TEST_IMAGES = [
  // Zoo animals (should be identified)
  { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/73/Lion_waiting_in_Namibia.jpg/800px-Lion_waiting_in_Namibia.jpg', label: 'Lion' },
  { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/37/African_Bush_Elephant.jpg/800px-African_Bush_Elephant.jpg', label: 'Elephant' },
  { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/Giraffe_Mikumi_National_Park.jpg/800px-Giraffe_Mikumi_National_Park.jpg', label: 'Giraffe' },
  { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/GoldenGateZoo-zebras.jpg/800px-GoldenGateZoo-zebras.jpg', label: 'Zebra' },
  { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/18/Polar_Bear_-_Alaska_%28cropped%29.jpg/800px-Polar_Bear_-_Alaska_%28cropped%29.jpg', label: 'Polar Bear' },
  // Non-zoo animals (should fail to match zoo list)
  { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/26/YellowLabradorLooking_new.jpg/800px-YellowLabradorLooking_new.jpg', label: 'Dog (Labrador)' },
  { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Cat03.jpg/800px-Cat03.jpg', label: 'House Cat' },
  { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/Felis_catus-cat_on_snow.jpg/800px-Felis_catus-cat_on_snow.jpg', label: 'Cat in Snow' },
  // Objects (should fail to identify as animal)
  { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Camponotus_flavomarginatus_ant.jpg/800px-Camponotus_flavomarginatus_ant.jpg', label: 'Ant (tiny)' },
  { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/Good_Food_Display_-_NCI_Visuals_Online.jpg/800px-Good_Food_Display_-_NCI_Visuals_Online.jpg', label: 'Food' },
  // Solid colors (should fail completely)
  { url: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect fill="#2D5A3D" width="800" height="600"/></svg>'), label: 'Green' },
  { url: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect fill="#D4654A" width="800" height="600"/></svg>'), label: 'Orange' },
  { url: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect fill="#1a1a1a" width="800" height="600"/></svg>'), label: 'Black' },
];

export default function Camera() {
  const navigate = useNavigate();
  const { activeVisit, activeZoo } = useStore();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const testImageRef = useRef<HTMLImageElement>(null);

  const [cameraState, setCameraState] = useState<CameraState>('scanning');
  const [result, setResult] = useState<IdentifiedAnimal | null>(null);
  const [funFail, setFunFail] = useState<FunFail | null>(null);
  const [animals, setAnimals] = useState<ZooAnimal[]>([]);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [testCameraEnabled] = useState(() =>
    localStorage.getItem('testCameraEnabled') === 'true'
  );
  const [testImageIndex, setTestImageIndex] = useState(0);

  const currentTestImage = TEST_IMAGES[testImageIndex];

  const nextTestImage = () => {
    setTestImageIndex((prev) => (prev + 1) % TEST_IMAGES.length);
  };

  const prevTestImage = () => {
    setTestImageIndex((prev) => (prev - 1 + TEST_IMAGES.length) % TEST_IMAGES.length);
  };

  useEffect(() => {
    if (!testCameraEnabled) {
      startCamera();
    }
    loadAnimals();
    return () => stopCamera();
  }, [testCameraEnabled]);

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
    if (!activeVisit || !activeZoo) {
      if (!activeVisit) {
        setErrorMessage('Please start a zoo visit first');
        setCameraState('error');
      }
      return;
    }

    if (!testCameraEnabled && (!videoRef.current || !canvasRef.current)) {
      return;
    }

    if (animals.length === 0) {
      setErrorMessage('No animals loaded for this zoo');
      setCameraState('error');
      return;
    }

    setCameraState('identifying');

    let imageData: string;

    if (testCameraEnabled && testImageRef.current && canvasRef.current) {
      // Use test image
      const canvas = canvasRef.current;
      const img = testImageRef.current;
      canvas.width = img.naturalWidth || 800;
      canvas.height = img.naturalHeight || 600;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      imageData = canvas.toDataURL('image/jpeg', 0.8);
    } else if (videoRef.current && canvasRef.current) {
      // Use live camera
      const canvas = canvasRef.current;
      const video = videoRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, 0);
      imageData = canvas.toDataURL('image/jpeg', 0.8);
    } else {
      return;
    }

    setCapturedImage(imageData);

    try {
      const identification = await identifyAnimal(imageData, animals);

      if (!identification.animal) {
        // Check for fun fail message from AI
        if (identification.failMessage) {
          setFunFail({
            emoji: identification.failEmoji || '🤔',
            message: identification.failMessage,
          });
          setCameraState('funFail');
        } else {
          setErrorMessage('Could not identify any animal in the image. Please try again.');
          setCameraState('error');
        }
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
        funFact: identification.funFact ?? matchedAnimal.funFact ?? undefined,
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
    setFunFail(null);
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
        {/* Video feed or test image */}
        {testCameraEnabled ? (
          <img
            ref={testImageRef}
            src={currentTestImage.url}
            crossOrigin="anonymous"
            alt={currentTestImage.label}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        ) : (
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
        )}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
            {testCameraEnabled && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}>
                <button
                  onClick={prevTestImage}
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '6px',
                    border: 'none',
                    background: 'rgba(255,255,255,0.2)',
                    color: '#fff',
                    fontSize: '14px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  ◀
                </button>
                <span style={{
                  padding: '6px 10px',
                  borderRadius: '8px',
                  background: colors.terracotta,
                  color: '#fff',
                  fontSize: '10px',
                  fontWeight: '700',
                  whiteSpace: 'nowrap',
                }}>
                  {currentTestImage.label} ({testImageIndex + 1}/{TEST_IMAGES.length})
                </span>
                <button
                  onClick={nextTestImage}
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '6px',
                    border: 'none',
                    background: 'rgba(255,255,255,0.2)',
                    color: '#fff',
                    fontSize: '14px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  ▶
                </button>
              </div>
            )}
          </div>
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

  // Fun fail view (non-zoo animal detected)
  if (cameraState === 'funFail' && funFail) {
    return (
      <div style={{
        height: '100vh',
        background: colors.cream,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        textAlign: 'center',
      }}>
        {/* Captured image thumbnail */}
        {capturedImage && (
          <div style={{
            width: '120px',
            height: '120px',
            borderRadius: '20px',
            overflow: 'hidden',
            marginBottom: '20px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            border: `3px solid ${colors.sand}`,
          }}>
            <img
              src={capturedImage}
              alt="Captured"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          </div>
        )}

        <span style={{ fontSize: '72px', marginBottom: '16px' }}>{funFail.emoji}</span>
        <h2 style={{
          margin: '0 0 12px',
          fontSize: '22px',
          fontWeight: '700',
          color: colors.text,
        }}>
          Not Quite!
        </h2>
        <p style={{
          margin: '0 0 32px',
          fontSize: '16px',
          color: colors.textMuted,
          lineHeight: '1.6',
          maxWidth: '300px',
        }}>
          {funFail.message}
        </p>
        <button
          onClick={handleTryAgain}
          style={{
            padding: '16px 40px',
            borderRadius: '14px',
            border: 'none',
            background: colors.forest,
            color: '#fff',
            fontSize: '16px',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          📷 Try Again
        </button>
        <BottomNav active="camera" />
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
      <BottomNav active="camera" />
    </div>
  );
}
