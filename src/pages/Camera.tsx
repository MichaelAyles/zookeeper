import { useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../stores/useStore';
import { getAnimalsByZoo } from '../services/animals';
import { identifyAnimal, findAnimalByName } from '../services/identification';
import { addAISighting } from '../services/sightings';
import type { ZooAnimal, IdentificationResult } from '../types';

export default function Camera() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { activeVisit, activeZoo, setCapturedImage, updateChecklistItem } = useStore();

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [identifying, setIdentifying] = useState(false);
  const [result, setResult] = useState<IdentificationResult | null>(null);
  const [matchedAnimal, setMatchedAnimal] = useState<ZooAnimal | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Start camera on mount
  const startCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error('Camera error:', err);
      setError('Could not access camera. Please grant permission and try again.');
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  }, [stream]);

  // Capture photo
  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    setCapturing(true);
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx?.drawImage(video, 0, 0);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    const base64 = dataUrl.split(',')[1];

    setCapturedPhoto(dataUrl);
    setCapturedImage(base64);
    stopCamera();
    setCapturing(false);

    // Identify
    await identifyPhoto(base64);
  };

  const identifyPhoto = async (base64: string) => {
    if (!activeZoo) return;

    setIdentifying(true);
    setError(null);

    try {
      const animals = await getAnimalsByZoo(activeZoo.id);
      const identification = await identifyAnimal(base64, animals);

      setResult(identification);

      if (identification.animal) {
        const animal = findAnimalByName(identification.animal, animals);
        setMatchedAnimal(animal || null);
      }
    } catch (err) {
      console.error('Identification failed:', err);
      setError('Failed to identify animal. Please try again.');
    } finally {
      setIdentifying(false);
    }
  };

  const handleConfirm = async () => {
    if (!activeVisit || !matchedAnimal || !result) return;

    const capturedBase64 = useStore.getState().capturedImage;
    await addAISighting(
      activeVisit.id,
      matchedAnimal.id,
      result.confidence,
      capturedBase64 || undefined
    );

    updateChecklistItem(matchedAnimal.id, {
      seen: true,
      sighting: {
        id: crypto.randomUUID(),
        visitId: activeVisit.id,
        animalId: matchedAnimal.id,
        seenAt: new Date(),
        aiIdentified: true,
        aiConfidence: result.confidence,
        photoBase64: capturedBase64 || undefined,
      },
    });

    navigate(-1);
  };

  const handleRetake = () => {
    setResult(null);
    setMatchedAnimal(null);
    setCapturedPhoto(null);
    setCapturedImage(null);
    startCamera();
  };

  // Auto-start camera
  useState(() => {
    startCamera();
    return () => stopCamera();
  });

  // Result view
  if (result && capturedPhoto) {
    return (
      <div className="min-h-screen bg-black flex flex-col">
        {/* Photo background */}
        <div className="fixed inset-0">
          <img src={capturedPhoto} alt="Captured" className="w-full h-full object-cover opacity-40" />
        </div>

        {/* Success overlay */}
        {result.animal && (
          <div className="fixed inset-0 bg-gradient-radial from-success/20 to-transparent pointer-events-none" />
        )}

        {/* Header */}
        <header className="relative z-10 p-4 flex justify-between">
          <button
            onClick={() => navigate(-1)}
            className="w-11 h-11 rounded-full bg-white/15 backdrop-blur-md
                       flex items-center justify-center text-white text-2xl"
          >
            ×
          </button>
          <button
            onClick={handleRetake}
            className="px-4 py-2 rounded-full bg-white/15 backdrop-blur-md
                       text-white text-sm font-semibold flex items-center gap-2"
          >
            🔄 Retake
          </button>
        </header>

        {/* Result */}
        <main className="flex-1 flex flex-col justify-end p-5 relative z-10">
          {result.animal && matchedAnimal ? (
            <>
              <div className="inline-flex items-center gap-2 bg-success text-white
                              px-4 py-2 rounded-full text-sm font-bold uppercase tracking-wide mb-4 self-start">
                <span className="w-5 h-5 bg-white/30 rounded-full flex items-center justify-center text-xs">✓</span>
                Animal Identified!
              </div>

              <div className="bg-white/95 backdrop-blur-xl rounded-[28px] p-6 shadow-[var(--shadow-card)]">
                <div className="flex gap-4 mb-5">
                  <div className="w-16 h-16 rounded-[20px] bg-gradient-to-br from-sand to-savanna
                                  flex items-center justify-center text-4xl">
                    🦁
                  </div>
                  <div className="flex-1">
                    <h1 className="font-display text-2xl font-bold text-forest">{matchedAnimal.commonName}</h1>
                    <p className="text-bark italic">{matchedAnimal.scientificName}</p>
                    <div className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full
                                    bg-success/15 text-success text-sm font-semibold">
                      <span className="w-2 h-2 bg-success rounded-full" />
                      {Math.round(result.confidence * 100)}% match
                    </div>
                  </div>
                </div>

                {(result.funFact || matchedAnimal.funFact) && (
                  <div className="bg-gradient-to-r from-canopy/10 to-savanna/10 rounded-[16px] p-4 mb-6">
                    <div className="flex gap-3">
                      <span className="text-2xl">💡</span>
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wide text-canopy mb-1">Did you know?</div>
                        <p className="text-sm text-forest">{result.funFact || matchedAnimal.funFact}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => navigate(-1)}
                    className="flex-1 py-4 rounded-[16px] border-2 border-sand
                               font-display font-semibold text-forest
                               flex items-center justify-center gap-2"
                  >
                    ✏️ Wrong?
                  </button>
                  <button
                    onClick={handleConfirm}
                    className="flex-1 py-4 rounded-[16px] bg-forest text-white
                               font-display font-semibold shadow-[var(--shadow-button)]
                               flex items-center justify-center gap-2"
                  >
                    ✓ Add to Collection
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white/95 backdrop-blur-xl rounded-[28px] p-6 shadow-[var(--shadow-card)] text-center">
              <div className="text-5xl mb-4">🤔</div>
              <h2 className="font-display text-xl font-bold text-forest mb-2">Couldn't Identify</h2>
              <p className="text-bark mb-6">
                We couldn't match this photo to an animal at {activeZoo?.name}. Try getting closer or adjusting the angle.
              </p>
              <button
                onClick={handleRetake}
                className="w-full py-4 rounded-[16px] bg-forest text-white
                           font-display font-semibold"
              >
                Try Again
              </button>
            </div>
          )}
        </main>
      </div>
    );
  }

  // Camera view
  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Hidden canvas for capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Video feed */}
      <div className="flex-1 relative">
        {error ? (
          <div className="absolute inset-0 flex items-center justify-center p-8 text-center">
            <div>
              <div className="text-5xl mb-4">📷</div>
              <p className="text-white/80 mb-4">{error}</p>
              <button
                onClick={startCamera}
                className="px-6 py-3 bg-white/20 rounded-full text-white font-semibold"
              >
                Try Again
              </button>
            </div>
          </div>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        )}

        {/* Viewfinder overlay */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-16 border-2 border-white/30 rounded-3xl" />
        </div>

        {/* Instructions */}
        {!identifying && (
          <div className="absolute bottom-32 left-0 right-0 text-center text-white/80 text-sm">
            Point at an animal and tap
          </div>
        )}

        {/* Identifying overlay */}
        {identifying && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin text-5xl mb-4">🔍</div>
              <p className="text-white font-semibold">Identifying...</p>
            </div>
          </div>
        )}
      </div>

      {/* Header */}
      <header className="absolute top-0 left-0 right-0 p-4 flex justify-between z-10">
        <button
          onClick={() => {
            stopCamera();
            navigate(-1);
          }}
          className="w-11 h-11 rounded-full bg-white/15 backdrop-blur-md
                     flex items-center justify-center text-white text-2xl"
        >
          ×
        </button>
        <button
          onClick={() => {
            // Toggle camera facing mode (future)
          }}
          className="w-11 h-11 rounded-full bg-white/15 backdrop-blur-md
                     flex items-center justify-center text-white text-xl"
        >
          🔄
        </button>
      </header>

      {/* Capture button */}
      <div className="absolute bottom-8 left-0 right-0 flex justify-center z-10">
        <button
          onClick={capturePhoto}
          disabled={!stream || capturing || identifying}
          className="w-20 h-20 rounded-full bg-white flex items-center justify-center
                     shadow-lg disabled:opacity-50 transition-transform active:scale-95"
        >
          <div className="w-16 h-16 rounded-full bg-white border-4 border-terracotta" />
        </button>
      </div>
    </div>
  );
}
