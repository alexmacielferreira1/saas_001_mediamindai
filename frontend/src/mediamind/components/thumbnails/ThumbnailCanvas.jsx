import React, { forwardRef } from 'react';
import { formatEpisode } from '../../lib/thumbnailStudio';

function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function Waves({ color }) {
  return <svg data-testid="simers-wave-pattern" aria-hidden="true" viewBox="0 0 1000 600" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full opacity-[.08]"><g fill="none" stroke={color} strokeWidth="1.6">{Array.from({ length: 13 }, (_, index) => <path key={index} d={`M -80 ${285 + index * 9} C 120 ${110 + index * 7}, 285 ${500 - index * 5}, 480 ${300 + index * 6} S 780 ${85 + index * 8}, 1090 ${315 + index * 4}`} />)}</g></svg>;
}

function ProgramMark({ program, vertical }) {
  const base = `uppercase leading-[.88] ${vertical ? 'text-[8cqw]' : 'text-[3.4cqw]'}`;
  if (program === 'Anamnese') return <div className={`${vertical ? 'text-[8cqw]' : 'text-[4cqw]'} font-serif normal-case leading-none`}>Anamnese<small className="block text-right text-[.26em] font-bold italic text-[#E5BE48]">com Marcelo Matias</small></div>;
  if (program === 'Pediatrando') return <div className={`${base} -rotate-3 font-black normal-case [font-family:Montserrat,sans-serif]`}>Pediatrando</div>;
  if (program === 'Plantão do Rock') return <div className={`${base} font-normal [font-family:Anton,sans-serif]`}>PLANTÃO<br/><span className="text-[.65em] underline">DO</span> ROCK</div>;
  if (program === 'Ética na Mesa') return <div className={`${base} -rotate-6 font-normal [font-family:Anton,sans-serif]`}>ÉTICA<small className="block text-center text-[.4em] text-[#188663]">NA MESA</small></div>;
  if (program === 'No Front') return <div className={`${base} font-normal [font-family:Anton,sans-serif]`}>NO FRONT<small className="block rounded-full bg-[#063236] px-[.5em] py-[.05em] text-center text-[.32em] tracking-normal text-white">A DEFESA DA MEDICINA</small></div>;
  if (program === 'Solidariza+') return <div className={`${base} font-black`}>SOLIDARIZA<span className="text-red-600">+</span></div>;
  return <div className={`${base} font-normal [font-family:Anton,sans-serif]`}>{program || 'PROGRAMA'}</div>;
}

function headlineColors(program, colors) {
  if (program === 'Prontuário Jurídico' || program === 'Sala de Prescrição') return [colors.text, '#FFFFFF'];
  if (program === 'Fronteiras da Saúde' || program === 'Pediatrando') return [colors.text, colors.accent];
  return [colors.text, colors.text];
}

function Headline({ text, program, colors, vertical }) {
  const colon = text.indexOf(':');
  const first = colon >= 0 ? text.slice(0, colon + 1) : text;
  const second = colon >= 0 ? text.slice(colon + 1).trim() : '';
  const [firstColor, secondColor] = headlineColors(program, colors);
  const size = vertical ? 'text-[clamp(30px,14cqw,96px)]' : 'text-[clamp(28px,7cqw,78px)]';
  return <h2 className={`${size} whitespace-pre-line font-normal uppercase leading-[.9] tracking-[-.025em] [font-family:Anton,Impact,sans-serif]`}><span style={{ color: firstColor }}>{first}</span>{second && <><br/><span style={{ color: secondColor }}>{second}</span></>}</h2>;
}

function portraitFilter(program) {
  const outline = program === 'Ética na Mesa' ? '#C8E65B' : '#FFFFFF';
  return `grayscale(1) drop-shadow(3px 0 0 ${outline}) drop-shadow(-3px 0 0 ${outline}) drop-shadow(0 3px 0 ${outline}) drop-shadow(0 -3px 0 ${outline}) drop-shadow(2px 2px 0 ${outline}) drop-shadow(-2px 2px 0 ${outline}) drop-shadow(2px -2px 0 ${outline}) drop-shadow(-2px -2px 0 ${outline}) drop-shadow(0 9px 9px rgba(0,0,0,.28))`;
}

const ThumbnailCanvas = forwardRef(function ThumbnailCanvas({ draft, format, simers = true, referenceUrl = '' }, ref) {
  const vertical = format === 'vertical';
  const people = draft.people.filter((person) => person.visible);
  const namedPeople = people.filter((person) => person.showName).map((person) => person.name);
  const colors = draft.colors;
  const episode = formatEpisode(draft.episode);
  const meta = [draft.program?.toUpperCase(), episode].filter(Boolean).join(' • ');
  const headline = draft.highlight || draft.title || 'SUA CHAMADA PRINCIPAL';
  if (!simers) return (
    <div ref={ref} data-testid={`thumbnail-canvas-${format}`} className={`relative isolate w-full overflow-hidden rounded-xl bg-slate-900 shadow-2xl ${vertical ? 'aspect-[9/16]' : 'aspect-video'}`} style={{ background: draft.colors.background, color: draft.colors.text, containerType: 'inline-size' }}>
      {referenceUrl && <img src={referenceUrl} alt="Referência da composição" className="absolute inset-0 h-full w-full object-cover opacity-55" />}
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/20" />
      <div className={`absolute z-10 ${vertical ? 'inset-x-[8%] bottom-[9%]' : 'left-[6%] bottom-[10%] w-[62%]'}`}><h2 className={`${vertical ? 'text-[14cqw]' : 'text-[7cqw]'} font-black uppercase leading-[.92] [font-family:Anton,Impact,sans-serif]`}>{headline}</h2>{namedPeople.length > 0 && <p className={`${vertical ? 'text-[5cqw]' : 'text-[2.6cqw]'} mt-[4%] font-bold`}>{namedPeople.join(' • ')}</p>}</div>
    </div>
  );
  return (
    <div ref={ref} data-testid={`thumbnail-canvas-${format}`} className={`relative isolate w-full overflow-hidden rounded-xl shadow-2xl ${vertical ? 'aspect-[9/16]' : 'aspect-video'}`} style={{ background: colors.background, color: colors.text, containerType: 'inline-size' }}>
      <Waves color={colors.text} />
      <img src="/brand/canal-simers-white.png" alt="Canal Simers" className={`absolute z-20 object-contain object-left-top ${vertical ? 'left-[7.5%] top-[4.5%] w-[28%]' : 'left-[5%] top-[5.5%] w-[15%]'}`} />
      <div className={`absolute z-20 ${vertical ? 'left-1/2 top-[12%] w-[76%] -translate-x-1/2 text-center' : 'left-[39%] top-[5%] w-[31%] text-center'}`}><ProgramMark program={draft.program} vertical={vertical} /></div>
      <div className={`absolute z-20 ${vertical ? 'left-[7.5%] right-[7.5%] top-[25%]' : 'bottom-[10%] left-[5%] w-[58%]'}`}>
        <Headline text={headline} program={draft.program} colors={colors} vertical={vertical} />
        {namedPeople.length > 0 && <p className={`mt-[4%] font-semibold leading-tight [font-family:Montserrat,Arial,sans-serif] ${vertical ? 'text-[5.8cqw]' : 'text-[3cqw]'}`}>{namedPeople.join(' • ')}</p>}
        <p className={`mt-[3%] font-semibold uppercase tracking-[.08em] [font-family:Montserrat,Arial,sans-serif] ${vertical ? 'text-[3.7cqw]' : 'text-[1.7cqw]'}`}>{meta}</p>
      </div>
      <div className={`absolute z-10 flex items-end justify-center ${vertical ? 'bottom-[-1%] left-[3%] right-[3%] h-[41%]' : 'bottom-[-1%] right-[-2%] h-[84%] w-[51%]'} ${people.length > 2 ? '-space-x-[16%]' : '-space-x-[9%]'}`}>
        {people.map((person, index) => <div key={person.id} className="relative flex h-full min-w-0 flex-1 items-end justify-center" style={{ zIndex: people.length - Math.abs(index - (people.length - 1) / 2) }}>{person.photo ? <img src={person.photo} alt={person.name} crossOrigin="anonymous" data-cutout-style={draft.program === 'Ética na Mesa' ? 'lime-outline' : 'white-outline'} className="max-h-full max-w-full object-contain" style={{ filter: portraitFilter(draft.program) }} /> : <div className="mb-[10%] grid aspect-[4/5] w-[76%] place-items-center rounded-t-full border-[3px] border-white bg-black/15 text-[9cqw] font-black opacity-70">{initials(person.name)}</div>}</div>)}
      </div>
    </div>
  );
});

export default ThumbnailCanvas;
