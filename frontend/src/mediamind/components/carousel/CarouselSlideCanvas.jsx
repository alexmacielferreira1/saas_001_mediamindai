const palettes = {
  health: ["#f7f4ea", "#eef8f5", "#00898c"],
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
  editable = false,
  onChange,
  layers,
  totalSlides,
}) {
  const colors = palettes[theme] || palettes.night;
  const light = theme === "paper" || theme === "health";
  const dimensions = getSocialFormat(format);
  const layer = (id) => layers?.find((item) => item.id === id) || { visible: true, locked: false };
  if (theme === "single-news") {
    const phrase = slide.highlightText || "";
    const position = phrase ? slide.title.toLocaleLowerCase().indexOf(phrase.toLocaleLowerCase()) : -1;
    const titleParts = position >= 0 ? [slide.title.slice(0, position), slide.title.slice(position, position + phrase.length), slide.title.slice(position + phrase.length)] : [slide.title, "", ""];
    const imagePosition = slide.imagePosition || "top";
    const photo = layer("media").visible && slide.image ? <img src={slide.image} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center bg-slate-200 px-6 text-center text-sm font-bold text-slate-500">ADICIONE A FOTO DA PUBLICAÇÃO</div>;
    const imageBlock = imagePosition !== "background" && <div style={{ height: `${slide.imageRatio || 48}%` }} className="shrink-0 border-b-[8px] border-[#071b45]">{photo}</div>;
    return (
      <article data-testid="single-news-art" data-carousel-slide data-carousel-slide-id={slide.id} style={{ aspectRatio: `${dimensions.width} / ${dimensions.height}`, fontFamily: profile.fontFamily || "Arial,sans-serif", backgroundColor: slide.backgroundColor || "#62d7c4", color: slide.textColor || "#032f39" }} className={`relative flex w-full overflow-hidden rounded-2xl ${imagePosition === "bottom" ? "flex-col-reverse" : "flex-col"}`}>
        {imagePosition === "background" && <div className="absolute inset-0 opacity-35">{photo}</div>}
        {imageBlock}
        <div className="relative flex min-h-0 flex-1 flex-col justify-between overflow-hidden px-[8%] py-[6%]">
          <div className="absolute -right-[12%] -top-[5%] h-[65%] w-[65%] rounded-[45%] border-[28px] border-current opacity-[0.04]" />
          {layer("title").visible && <h3 data-testid="carousel-title" contentEditable={editable && !layer("title").locked} suppressContentEditableWarning onBlur={(event) => onChange?.("title", event.currentTarget.textContent || "")} style={{ fontSize: `${Math.min(slide.titleSize || 48, 54)}px`, lineHeight: slide.lineHeight || 1.08 }} className="relative font-semibold outline-none">
            {titleParts[0]}{titleParts[1] && <mark data-testid="single-art-highlight" style={{ backgroundColor: slide.highlightColor || "#071b45", color: slide.highlightTextColor || "#62d7c4" }} className="rounded-full px-2 py-0.5">{titleParts[1]}</mark>}{titleParts[2]}
          </h3>}
          {layer("footer").visible && <div className="relative flex items-center gap-2 text-[clamp(18px,4vw,38px)] font-black lowercase"><span className="text-[1.35em]">◒</span><span>simers</span></div>}
        </div>
      </article>
    );
  }
  if (theme === "giro") {
    const cover = slide.type === "cover";
    return (
      <article data-carousel-slide data-carousel-slide-id={slide.id} style={{ aspectRatio: `${dimensions.width} / ${dimensions.height}`, fontFamily: profile.fontFamily || "Arial,sans-serif" }} className="relative flex w-full flex-col overflow-hidden rounded-2xl bg-[#003b3e] text-[#fffbed]">
        {cover ? <>
          <div className="absolute -left-[15%] -top-[10%] h-[48%] w-[65%] rotate-12 rounded-[45%] bg-[#004b4c]" />
          <div className="absolute -right-[20%] top-[8%] h-[55%] w-[62%] -rotate-12 rounded-[48%] bg-[#00494a]" />
          <div className="absolute bottom-[12%] left-[28%] h-[42%] w-[48%] rotate-12 rounded-[45%] bg-[#004849]" />
          <div className="relative flex flex-1 flex-col justify-center px-[10%] pb-[14%]">
            {layer("title").visible && <h3 data-testid="carousel-title" contentEditable={editable && !layer("title").locked} suppressContentEditableWarning onBlur={(event) => onChange?.("title", event.currentTarget.textContent || "")} className="max-w-[92%] whitespace-pre-line text-[clamp(28px,7vw,62px)] font-black uppercase leading-[0.95] outline-none">{slide.title || "GIRO DE NOTÍCIAS DA SEMANA"}</h3>}
            <div className="mt-7 flex items-center gap-3 text-[clamp(13px,2.4vw,25px)] font-bold italic">
              <span className="grid aspect-square w-[12%] place-items-center rounded-xl bg-[#00bd78] text-white">▣</span>
              {layer("body").visible && <span contentEditable={editable && !layer("body").locked} suppressContentEditableWarning onBlur={(event) => onChange?.("body", event.currentTarget.textContent || "")}>{slide.body}</span>}
            </div>
          </div>
          {layer("footer").visible && <div className="relative flex h-[13%] items-center gap-3 bg-[#00b978] px-[10%]"><strong className="text-[clamp(24px,5vw,48px)] lowercase">simers</strong><span className="max-w-[42%] text-[clamp(7px,1.3vw,13px)] leading-tight">{profile.handle}</span></div>}
        </> : <>
          <div className="relative h-[46%] shrink-0 bg-[#d8ddd9]">
            {layer("media").visible && slide.image ? <img src={slide.image} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-sm font-bold text-[#436163]">ADICIONE A FOTO DESTA NOTÍCIA</div>}
          </div>
          <div className="relative flex flex-1 bg-[#f1f2df] text-[#003b3e]">
            <div className="w-[18%] shrink-0 bg-[#003b3e]"><div className="mt-[75%] aspect-square w-full bg-[#00bd78]" /></div>
            <div className="flex min-w-0 flex-1 flex-col px-[7%] py-[5%]">
              {layer("identity").visible && <div className="flex items-center justify-between gap-2"><span className="rounded-full bg-[#00bd78] px-3 py-1 text-[clamp(8px,1.5vw,14px)] font-black uppercase">{slide.badge || "GIRO DE NOTÍCIAS DA SEMANA"}</span><strong>{index + 1}/{totalSlides || "8"}</strong></div>}
              {layer("title").visible && <h3 data-testid="carousel-title" contentEditable={editable && !layer("title").locked} suppressContentEditableWarning onBlur={(event) => onChange?.("title", event.currentTarget.textContent || "")} className="mt-[7%] text-[clamp(18px,4vw,38px)] font-black uppercase leading-[1.02] outline-none">{slide.title}</h3>}
              {layer("body").visible && <p contentEditable={editable && !layer("body").locked} suppressContentEditableWarning onBlur={(event) => onChange?.("body", event.currentTarget.textContent || "")} className="mt-auto text-[clamp(9px,1.6vw,15px)] leading-snug outline-none">{slide.body}</p>}
            </div>
          </div>
        </>}
      </article>
    );
  }
  return (
    <article
      data-carousel-slide
      data-carousel-slide-id={slide.id}
      style={{
        background: `linear-gradient(135deg,${colors[0]},${colors[1]})`,
        color: light ? "#1e293b" : "white",
        fontFamily: profile.fontFamily || "Arial,sans-serif",
        aspectRatio: `${dimensions.width} / ${dimensions.height}`,
      }}
      className="relative flex w-full flex-col justify-between overflow-hidden rounded-2xl p-7"
    >
      {layer("media").visible && slide.image && (
        <img
          src={slide.image}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-25"
        />
      )}
      {layer("media").visible && slide.mediaType === "video" && slide.video && (
        <video
          src={slide.video}
          muted
          loop
          autoPlay
          playsInline
          className="absolute inset-0 h-full w-full object-cover opacity-40"
        />
      )}
      <div
        className="absolute -right-16 -top-16 h-56 w-56 rounded-full border-[35px] opacity-10"
        style={{ borderColor: colors[2] }}
      />
      {theme === "health" && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[28%] overflow-hidden">
          <div className="absolute -left-[10%] top-[35%] h-[90%] w-[120%] rounded-[50%] bg-[#00979a]/25" />
          <div className="absolute -left-[8%] top-[55%] h-[90%] w-[120%] rounded-[50%] bg-[#008487]/55" />
          <div className="absolute -left-[5%] top-[75%] h-[90%] w-[115%] rounded-[50%] bg-[#006a70]" />
        </div>
      )}
      {layer("identity").visible && <div
        className="relative flex items-center justify-between text-[10px] font-bold uppercase tracking-widest"
        style={{ color: colors[2] }}
      >
        <span>{slide.badge || profile.name || "MEDIAMIND"}</span>
        <span>{String(index + 1).padStart(2, "0")}</span>
      </div>}
      <div className="relative" style={{ textAlign: slide.textAlign || "left" }}>
        <div
          className="mb-4 h-1 w-10 rounded"
          style={{ background: colors[2] }}
        />
        {layer("title").visible && <h3
          data-testid="carousel-title"
          className={`break-words font-black outline-none ${editable ? "cursor-text rounded focus:ring-2 focus:ring-cyan-400/70" : ""}`}
          contentEditable={editable && !layer("title").locked}
          suppressContentEditableWarning
          onBlur={(event) => onChange?.("title", event.currentTarget.textContent || "")}
          style={{ fontSize: `${slide.titleSize || 48}px`, lineHeight: slide.lineHeight || 1.05, letterSpacing: `${slide.letterSpacing || 0}px` }}
        >
          {slide.title || "Seu título aqui"}
        </h3>}
        {layer("body").visible && slide.body && (
          <p
            className={`mt-5 whitespace-pre-wrap break-words opacity-85 outline-none ${editable ? "cursor-text rounded focus:ring-2 focus:ring-cyan-400/70" : ""}`}
            contentEditable={editable && !layer("body").locked}
            suppressContentEditableWarning
            onBlur={(event) => onChange?.("body", event.currentTarget.textContent || "")}
            style={{ fontSize: `${slide.bodySize || 18}px`, lineHeight: Math.max(1.2, slide.lineHeight || 1.05) }}
          >
            {slide.body}
          </p>
        )}
      </div>
      {layer("footer").visible && <div
        className="relative flex justify-between gap-2 text-xs font-bold"
        style={{ color: colors[2] }}
      >
        <span>
          {slide.action || profile.handle || "Salve para consultar depois"}
        </span>
        <span>→</span>
      </div>}
    </article>
  );
}
import { getSocialFormat } from "../../lib/socialFormats";
