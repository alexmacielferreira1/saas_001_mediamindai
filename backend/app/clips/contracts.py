from pydantic import BaseModel, Field, model_validator


class TranscriptWord(BaseModel):
    text: str = Field(min_length=1, max_length=500)
    start: float = Field(ge=0)
    end: float = Field(gt=0)

    @model_validator(mode="after")
    def end_follows_start(self) -> "TranscriptWord":
        if self.end <= self.start:
            raise ValueError("O fim da palavra deve ser posterior ao início.")
        return self


class TranscriptSegment(BaseModel):
    start: float = Field(ge=0)
    end: float = Field(gt=0)
    text: str = Field(min_length=1, max_length=10000)
    words: list[TranscriptWord] = Field(min_length=1)


class CandidateDimensions(BaseModel):
    hook: int = Field(ge=0, le=25)
    flow: int = Field(ge=0, le=25)
    value: int = Field(ge=0, le=25)
    shareability: int = Field(ge=0, le=25)

    @property
    def total(self) -> int:
        return self.hook + self.flow + self.value + self.shareability


class ClipCandidate(BaseModel):
    start: float = Field(ge=0)
    end: float = Field(gt=0)
    quote: str = Field(min_length=1, max_length=10000)
    score: int = Field(ge=0, le=100)
    dimensions: CandidateDimensions
    evidence: list[TranscriptWord] = Field(min_length=1)

    @property
    def duration(self) -> float:
        return self.end - self.start


class CaptionCue(BaseModel):
    start: float = Field(ge=0)
    end: float = Field(gt=0)
    text: str = Field(min_length=1, max_length=1000)
