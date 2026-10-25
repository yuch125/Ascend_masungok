export default function PageIntro({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="page-intro">
      <span className="eyebrow">{eyebrow}</span>
      <h1>
        {title}
        <span className="title-dot">.</span>
      </h1>
      <p>{description}</p>
    </div>
  );
}
