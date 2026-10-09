const palettes = {
  night: ["#09172d", "#102b44", "#38bdf8"],
  violet: ["#17102b", "#392753", "#c4b5fd"],
  paper: ["#f5f0e6", "#e7dfcf", "#9a5919"],
  coral: ["#2b1018", "#501f2c", "#fb7185"],
  forest: ["#081f1c", "#153d34", "#6ee7b7"],
  blue: ["#08204c", "#174aa2", "#93c5fd"],
};
export default function CarouselSlideCanvas({
  slide,
  format = "4:5",
  index = 0,
  theme = "night",
  profile = {},
}) {
  const colors = palettes[theme] || palettes.night;
  const light = theme === "paper";
  return (
    <article
      data-carousel-slide
      data-carousel-slide-id={slide.id}
      style={{
        background: `linear-gradient(135deg,${colors[0]},${colors[1]})`,
        color: light ? "#1e293b" : "white",
        fontFamily: "Arial,sans-serif",
      }}
      className={`relative flex w-full flex-col justify-between overflow-hidden rounded-2xl p-7 ${format === "1:1" ? "aspect-square" : "aspect-[4/5]"}`}
    >
      {slide.image && (
        <img
          src={slide.image}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-25"
        />
      )}
      <div
        className="absolute -right-16 -top-16 h-56 w-56 rounded-full border-[35px] opacity-10"
        style={{ borderColor: colors[2] }}
      />
      <div
        className="relative flex items-center justify-between text-[10px] font-bold uppercase tracking-widest"
        style={{ color: colors[2] }}
      >
        <span>{slide.badge || profile.name || "MEDIAMIND"}</span>
        <span>{String(index + 1).padStart(2, "0")}</span>
      </div>
      <div className="relative">
        <div
          className="mb-4 h-1 w-10 rounded"
          style={{ background: colors[2] }}
        />
        <h3 className="break-words text-3xl font-black leading-tight">
          {slide.title || "Seu título aqui"}
        </h3>
        {slide.body && (
          <p className="mt-5 whitespace-pre-wrap break-words text-sm leading-relaxed opacity-85">
            {slide.body}
          </p>
        )}
      </div>
      <div
        className="relative flex justify-between gap-2 text-xs font-bold"
        style={{ color: colors[2] }}
      >
        <span>
          {slide.action || profile.handle || "Salve para consultar depois"}
        </span>
        <span>→</span>
      </div>
    </article>
  );
}
