import { LoginSlider } from "./LoginSlider";

interface SlideData {
  headline: string;
  text: string;
  image: string;
}

interface LoginBrandPanelProps {
  slides: SlideData[];
}

export function LoginBrandPanel({ slides }: LoginBrandPanelProps) {
  return (
    <div className="login-brand-panel">
      <LoginSlider slides={slides} />
    </div>
  );
}
