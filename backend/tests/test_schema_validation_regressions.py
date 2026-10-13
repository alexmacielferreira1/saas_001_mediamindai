import pytest
from app.schemas.admin_users import AdminSettingsPatch
from app.schemas.creative_tools import CarouselContent
from pydantic import ValidationError


def test_timezone_none_is_allowed_but_unknown_zone_is_rejected():
    assert AdminSettingsPatch(timezone=None).timezone is None
    with pytest.raises(ValidationError):
        AdminSettingsPatch(timezone="Unknown/City")


def test_carousel_rejects_hashtags_without_prefix():
    with pytest.raises(ValueError, match="hashtags must start"):
        CarouselContent.validate_hashtags(["#valid", "invalid"])


def test_carousel_accepts_custom_dimensions_and_rejects_unknown_format():
    assert CarouselContent.validate_format("custom:1200x800") == "custom:1200x800"
    with pytest.raises(ValueError, match="unsupported"):
        CarouselContent.validate_format("unknown")
