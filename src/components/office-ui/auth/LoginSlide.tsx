interface LoginSlideProps {
  slide: {
    headline: string;
    text: string;
    image: string;
  };
}

export function LoginSlide({ slide }: LoginSlideProps) {
  return (
    <>
      <div className="login-slide__image">
        <img src={slide.image} alt={slide.headline} />
      </div>
      <div className="login-slide__content">
        <h2 className="login-slide__headline">{slide.headline}</h2>
        <p className="login-slide__text">{slide.text}</p>
      </div>
    </>
  );
}
