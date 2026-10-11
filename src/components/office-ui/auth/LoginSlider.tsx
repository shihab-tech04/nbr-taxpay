import { useState, useEffect, useCallback, useRef } from "react";
import { Pause, Play } from "lucide-react";
import { LoginSlide } from "./LoginSlide";

const AUTOPLAY_INTERVAL = 7000;
const FADE_DURATION = 600; // ms — must match CSS

interface SlideData {
  headline: string;
  text: string;
  image: string;
}

interface LoginSliderProps {
  slides: SlideData[];
}

export function LoginSlider({ slides }: LoginSliderProps) {
  const [current, setCurrent] = useState(0);
  const [prev, setPrev] = useState<number | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const [paused, setPaused] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transitionRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const goTo = useCallback((next: number) => {
    if (transitioning) return;
    setPrev((p) => p !== null ? current : current);
    setTransitioning(true);
    setCurrent(next);

    if (transitionRef.current) clearTimeout(transitionRef.current);
    transitionRef.current = setTimeout(() => {
      setPrev(null);
      setTransitioning(false);
    }, FADE_DURATION);
  }, [current, transitioning]);

  const advance = useCallback(() => {
    const next = (current + 1) % slides.length;
    goTo(next);
  }, [current, slides.length, goTo]);

  useEffect(() => {
    if (paused) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(advance, AUTOPLAY_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [paused, advance]);

  return (
    <div className="login-slider">
      {/* Crossfade stage */}
      <div className="login-slide__stage">
        {/* Outgoing slide — fades out */}
        {prev !== null && (
          <div key={`out-${prev}`} className="login-slide__layer login-slide__layer--out">
            <LoginSlide slide={slides[prev]} />
          </div>
        )}
        {/* Incoming slide — fades in */}
        <div key={`in-${current}`} className="login-slide__layer login-slide__layer--in">
          <LoginSlide slide={slides[current]} />
        </div>
      </div>

      {/* Controls: dots + pause/play */}
      <div className="login-slide__controls">
        <div className="login-slide__dots">
          {slides.map((_, idx) => (
            <button
              key={idx}
              onClick={() => goTo(idx)}
              className={`login-slide__dot ${idx === current ? "login-slide__dot--active" : "login-slide__dot--inactive"}`}
              aria-label={`Go to slide ${idx + 1}`}
              aria-current={idx === current ? "true" : undefined}
            />
          ))}
        </div>

        <button
          onClick={() => setPaused((p) => !p)}
          className="login-slide__pause-btn"
          aria-label={paused ? "Play slideshow" : "Pause slideshow"}
          aria-pressed={paused}
        >
          {paused
            ? <Play size={12} strokeWidth={2.5} aria-hidden="true" />
            : <Pause size={12} strokeWidth={2.5} aria-hidden="true" />
          }
        </button>
      </div>
    </div>
  );
}
