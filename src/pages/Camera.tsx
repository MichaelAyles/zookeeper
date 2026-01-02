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
  const [zoom, setZoom] = useState(1);
  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(null);
  const [showFocusRing, setShowFocusRing] = useState(false);

  const currentTestImage = TEST_IMAGES[testImageIndex];
  const spottedCount = animals.length > 0 ? Math.floor(animals.length * 0.3) : 0; // Placeholder until we load real data

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

  async function handleTapToFocus(e: React.MouseEvent | React.TouchEvent) {
    const element = e.currentTarget as HTMLElement;
    const rect = element.getBoundingClientRect();

    // Get tap coordinates
    let clientX: number, clientY: number;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    // Calculate position relative to element
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    // Show focus ring animation
    setFocusPoint({ x, y });
    setShowFocusRing(true);

    // Try to set camera focus point (if supported)
    if (streamRef.current) {
      const track = streamRef.current.getVideoTracks()[0];
      const capabilities = track.getCapabilities?.() as MediaTrackCapabilities & {
        focusMode?: string[];
      };

      if (capabilities?.focusMode?.includes('manual') || capabilities?.focusMode?.includes('single-shot')) {
        try {
          // Calculate normalized coordinates (0-1)
          const focusX = (clientX - rect.left) / rect.width;
          const focusY = (clientY - rect.top) / rect.height;

          await track.applyConstraints({
            advanced: [{
              // @ts-expect-error - focusMode and pointsOfInterest are valid but not in TS types
              focusMode: 'single-shot',
              pointsOfInterest: [{ x: focusX, y: focusY }],
            }],
          });
        } catch (err) {
          // Focus control not supported, just show visual feedback
          console.log('Focus control not supported');
        }
      }
    }

    // Hide focus ring after animation
    setTimeout(() => setShowFocusRing(false), 800);
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
        background: colors.forest,
        overflow: 'hidden',
      }}>
        {/* Camera viewport with zoom - tap to focus */}
        <div
          onClick={handleTapToFocus}
          onTouchStart={handleTapToFocus}
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            cursor: 'crosshair',
          }}
        >
          {testCameraEnabled ? (
            <img
              ref={testImageRef}
              src={currentTestImage.url}
              crossOrigin="anonymous"
              alt={currentTestImage.label}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transform: `scale(${zoom})`,
                transition: 'transform 0.1s ease-out',
                pointerEvents: 'none',
              }}
            />
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transform: `scale(${zoom})`,
                transition: 'transform 0.1s ease-out',
                pointerEvents: 'none',
              }}
            />
          )}

          {/* Tap to focus indicator */}
          {showFocusRing && focusPoint && (
            <div
              style={{
                position: 'absolute',
                left: focusPoint.x - 40,
                top: focusPoint.y - 40,
                width: '80px',
                height: '80px',
                pointerEvents: 'none',
              }}
            >
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  border: `2px solid ${colors.gold}`,
                  borderRadius: '50%',
                  animation: 'focusPulse 0.6s ease-out forwards',
                  boxShadow: `0 0 20px ${colors.gold}80`,
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '8px',
                  height: '8px',
                  background: colors.gold,
                  borderRadius: '50%',
                  animation: 'focusDot 0.6s ease-out forwards',
                }}
              />
            </div>
          )}
        </div>
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {/* Subtle vignette overlay */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at center, transparent 40%, rgba(0,0,0,0.4) 100%)',
          pointerEvents: 'none',
        }} />

        {/* Top bar - glassmorphism */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          padding: '52px 16px 12px',
          background: 'linear-gradient(180deg, rgba(0,0,0,0.6) 0%, transparent 100%)',
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            {/* Zoo badge */}
            <button
              onClick={() => navigate('/')}
              style={{
                padding: '8px 14px',
                borderRadius: '20px',
                border: 'none',
                background: 'rgba(255,255,255,0.2)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                color: '#fff',
                fontSize: '13px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
              }}
            >
              <span style={{ fontSize: '14px' }}>📍</span>
              <span style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {activeZoo?.name || 'Select Zoo'}
              </span>
            </button>

            {/* Test mode controls */}
            {testCameraEnabled && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(0,0,0,0.4)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                borderRadius: '20px',
                padding: '4px',
              }}>
                <button
                  onClick={prevTestImage}
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    border: 'none',
                    background: 'rgba(255,255,255,0.2)',
                    color: '#fff',
                    fontSize: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  ◀
                </button>
                <span style={{
                  padding: '4px 8px',
                  color: '#fff',
                  fontSize: '11px',
                  fontWeight: '600',
                  whiteSpace: 'nowrap',
                }}>
                  {testImageIndex + 1}/{TEST_IMAGES.length}
                </span>
                <button
                  onClick={nextTestImage}
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    border: 'none',
                    background: 'rgba(255,255,255,0.2)',
                    color: '#fff',
                    fontSize: '12px',
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

            {/* Progress indicator */}
            <div style={{
              padding: '8px 14px',
              borderRadius: '20px',
              background: 'rgba(255,255,255,0.2)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              color: '#fff',
              fontSize: '13px',
              fontWeight: '600',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            }}>
              🎯 {spottedCount}/{animals.length}
            </div>
          </div>

          {/* Test mode label */}
          {testCameraEnabled && (
            <div style={{
              marginTop: '10px',
              textAlign: 'center',
            }}>
              <span style={{
                padding: '4px 12px',
                borderRadius: '12px',
                background: colors.terracotta,
                color: '#fff',
                fontSize: '11px',
                fontWeight: '700',
                letterSpacing: '0.5px',
              }}>
                TEST: {currentTestImage.label}
              </span>
            </div>
          )}
        </div>

        {/* Center focus ring */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
        }}>
          <div style={{
            width: '220px',
            height: '220px',
            position: 'relative',
          }}>
            {/* Animated ring */}
            <div style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '24px',
              border: `2px solid ${cameraState === 'identifying' ? colors.gold : 'rgba(255,255,255,0.4)'}`,
              boxShadow: cameraState === 'identifying'
                ? `0 0 30px ${colors.gold}50, inset 0 0 30px ${colors.gold}20`
                : '0 0 20px rgba(0,0,0,0.3)',
              transition: 'all 0.3s ease',
            }} />

            {/* Corner accents */}
            {[
              { top: -2, left: -2, borderTop: true, borderLeft: true },
              { top: -2, right: -2, borderTop: true, borderRight: true },
              { bottom: -2, left: -2, borderBottom: true, borderLeft: true },
              { bottom: -2, right: -2, borderBottom: true, borderRight: true },
            ].map((corner, i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  width: '40px',
                  height: '40px',
                  ...corner,
                  borderTop: corner.borderTop ? `4px solid ${colors.gold}` : 'none',
                  borderBottom: corner.borderBottom ? `4px solid ${colors.gold}` : 'none',
                  borderLeft: corner.borderLeft ? `4px solid ${colors.gold}` : 'none',
                  borderRight: corner.borderRight ? `4px solid ${colors.gold}` : 'none',
                  borderRadius: '8px',
                }}
              />
            ))}

            {/* Status pill */}
            <div style={{
              position: 'absolute',
              bottom: '-50px',
              left: '50%',
              transform: 'translateX(-50%)',
            }}>
              <div style={{
                padding: '10px 20px',
                background: cameraState === 'identifying'
                  ? colors.gold
                  : 'rgba(0,0,0,0.6)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                borderRadius: '20px',
                color: '#fff',
                fontSize: '14px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                transition: 'all 0.3s ease',
              }}>
                {cameraState === 'identifying' ? (
                  <>
                    <span style={{
                      display: 'inline-block',
                      animation: 'spin 1s linear infinite',
                    }}>⏳</span>
                    Identifying...
                  </>
                ) : (
                  <>
                    <span>🔍</span>
                    Point at animal
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right side zoom slider */}
        <div style={{
          position: 'absolute',
          right: '16px',
          top: '50%',
          transform: 'translateY(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px',
          padding: '12px 8px',
          background: 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderRadius: '24px',
        }}>
          <span style={{ color: '#fff', fontSize: '12px', fontWeight: '600' }}>+</span>
          <input
            type="range"
            min="1"
            max="3"
            step="0.1"
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            style={{
              width: '100px',
              height: '4px',
              appearance: 'none',
              background: 'rgba(255,255,255,0.3)',
              borderRadius: '2px',
              transform: 'rotate(-90deg)',
              cursor: 'pointer',
            }}
          />
          <span style={{ color: '#fff', fontSize: '12px', fontWeight: '600' }}>−</span>
          <div style={{
            marginTop: '4px',
            padding: '4px 8px',
            background: 'rgba(255,255,255,0.2)',
            borderRadius: '8px',
            color: '#fff',
            fontSize: '11px',
            fontWeight: '600',
          }}>
            {zoom.toFixed(1)}x
          </div>
        </div>

        {/* Bottom controls */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '24px 24px 40px',
          background: 'linear-gradient(0deg, rgba(0,0,0,0.8) 0%, transparent 100%)',
        }}>
          {/* Shutter row */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '32px',
          }}>
            {/* Gallery/Back button */}
            <button
              onClick={() => navigate(activeVisit ? `/visit/${activeVisit.id}` : '/')}
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '16px',
                border: '2px solid rgba(255,255,255,0.3)',
                background: 'rgba(255,255,255,0.1)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                fontSize: '22px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              📋
            </button>

            {/* Shutter button */}
            <button
              onClick={captureAndIdentify}
              disabled={cameraState === 'identifying' || !activeVisit}
              style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                border: 'none',
                background: cameraState === 'identifying'
                  ? colors.gold
                  : '#fff',
                cursor: cameraState === 'identifying' ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: !activeVisit ? 0.5 : 1,
                boxShadow: '0 4px 20px rgba(0,0,0,0.4), inset 0 -2px 8px rgba(0,0,0,0.1)',
                transition: 'all 0.2s ease',
                transform: cameraState === 'identifying' ? 'scale(0.95)' : 'scale(1)',
              }}
            >
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                border: `3px solid ${cameraState === 'identifying' ? '#fff' : colors.forest}`,
                background: cameraState === 'identifying'
                  ? 'transparent'
                  : `linear-gradient(135deg, ${colors.forest} 0%, ${colors.forestLight} 100%)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {cameraState === 'identifying' ? (
                  <span style={{ fontSize: '28px' }}>⏳</span>
                ) : (
                  <span style={{ fontSize: '28px' }}>🦁</span>
                )}
              </div>
            </button>

            {/* Flip camera button */}
            <button
              onClick={() => setZoom(1)}
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '16px',
                border: '2px solid rgba(255,255,255,0.3)',
                background: 'rgba(255,255,255,0.1)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                fontSize: '22px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              🔄
            </button>
          </div>

          {/* Help text */}
          {!activeVisit && (
            <p style={{
              textAlign: 'center',
              color: colors.terracotta,
              fontSize: '13px',
              fontWeight: '600',
              marginTop: '16px',
            }}>
              Start a zoo visit to identify animals
            </p>
          )}
        </div>

        {/* CSS for animations */}
        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes focusPulse {
            0% { transform: scale(1.5); opacity: 0; }
            30% { transform: scale(1); opacity: 1; }
            100% { transform: scale(0.9); opacity: 0; }
          }
          @keyframes focusDot {
            0% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
            30% { transform: translate(-50%, -50%) scale(1.2); opacity: 1; }
            60% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
            100% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
          }
          input[type="range"]::-webkit-slider-thumb {
            appearance: none;
            width: 16px;
            height: 16px;
            background: ${colors.gold};
            border-radius: 50%;
            cursor: pointer;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          }
        `}</style>
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
        {/* Photo background - show captured image */}
        <div style={{
          position: 'absolute',
          inset: 0,
        }}>
          {capturedImage ? (
            <img
              src={capturedImage}
              alt="Captured"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          ) : (
            <div style={{
              width: '100%',
              height: '100%',
              background: `linear-gradient(135deg, #C9A66B 0%, #8B7355 50%, #5A4A2F 100%)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <span style={{ fontSize: '150px', opacity: 0.25 }}>
                {categoryIcons[result.animal.category]}
              </span>
            </div>
          )}
          {/* Gradient overlay */}
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.3) 40%, rgba(0,0,0,0.95) 75%)',
          }} />
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
