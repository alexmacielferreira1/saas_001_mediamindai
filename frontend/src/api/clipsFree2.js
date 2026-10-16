import { request } from "./httpClient";

export function createClipsFree2Session({ assetId, format, captionStyle }) {
  return request("/clipsfree2/sessions", {
    method: "POST",
    body: { asset_id: assetId, format, caption_style: captionStyle },
  });
}
