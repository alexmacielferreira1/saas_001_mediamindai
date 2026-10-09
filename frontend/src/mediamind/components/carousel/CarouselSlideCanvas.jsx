export default function CarouselSlideCanvas({ slide, format = '4:5', index = 0 }) {
  const square = format === '1:1';
  return (
    <article
      data-carousel-slide data-carousel-slide-id={slide.id}
      className={`relative flex w-full flex-col justify-between overflow-hidden rounded-2xl border border-sky-500/30 bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 p-6 shadow-xl ${square ? 'aspect-square' : 'aspect-[4/5]'}`}
    >
      <div className="flex items-center justify-between text-xs font-bold uppercase tracking-[0.18em] text-sky-300">
        <span>{slide.badge || (slide.type === 'cover' ? 'MediaMind' : `Slide ${index + 1}`)}</span>
        <span>{String(index + 1).padStart(2, '0')}</span>
      </div>
      <div>
        <h3 className="text-3xl font-black leading-tight text-white">{slide.title || 'Digite um título'}</h3>
        {slide.body && <p className="mt-4 whitespace-pre-wrap text-base leading-relaxed text-slate-200">{slide.body}</p>}
      </div>
      <div className="text-sm font-semibold text-sky-300">{slide.action || 'MediaMind AI'}</div>
    </article>
  );
}
