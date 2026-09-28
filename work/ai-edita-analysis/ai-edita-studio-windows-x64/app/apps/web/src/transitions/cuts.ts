export interface CutElement<TTime extends number = number> {
	id: string;
	startTime: TTime;
	duration: TTime;
}

export interface TimelineCut<TTime extends number = number> {
	time: TTime;
	leftElementId: string;
	rightElementId: string;
}

export function findTransitionPair<
	TElement extends CutElement<TTime>,
	TTime extends number = number,
>({
	elements,
	centerTime,
	tolerance,
}: {
	elements: TElement[];
	centerTime: number;
	tolerance: number;
}): { outgoing: TElement; incoming: TElement } | null {
	const outgoing = elements.find(
		(element) =>
			Math.abs(element.startTime + element.duration - centerTime) <= tolerance,
	);
	const incoming = elements.find(
		(element) => Math.abs(element.startTime - centerTime) <= tolerance,
	);
	if (!outgoing || !incoming || outgoing.id === incoming.id) return null;
	return { outgoing, incoming };
}

export function findTimelineCuts<TTime extends number>({
	elements,
	tolerance,
}: {
	elements: CutElement<TTime>[];
	tolerance: number;
}): TimelineCut<TTime>[] {
	const sorted = [...elements]
		.filter((element) => element.duration > 0)
		.sort((left, right) => left.startTime - right.startTime);
	const cuts: TimelineCut<TTime>[] = [];
	for (let index = 1; index < sorted.length; index++) {
		const left = sorted[index - 1];
		const right = sorted[index];
		const leftEnd = left.startTime + left.duration;
		if (Math.abs(right.startTime - leftEnd) > tolerance) continue;
		cuts.push({
			time: right.startTime,
			leftElementId: left.id,
			rightElementId: right.id,
		});
	}
	return cuts;
}

export function findNearestCut<TTime extends number>({
	cuts,
	time,
}: {
	cuts: TimelineCut<TTime>[];
	time: number;
}): TimelineCut<TTime> | null {
	return (
		cuts.reduce<TimelineCut<TTime> | null>((nearest, cut) => {
			if (!nearest) return cut;
			return Math.abs(cut.time - time) < Math.abs(nearest.time - time)
				? cut
				: nearest;
		}, null) ?? null
	);
}
