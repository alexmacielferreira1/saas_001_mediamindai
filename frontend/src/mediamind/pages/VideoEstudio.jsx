import AgenciaVideo from "./AgenciaVideo";

// VIDEO_ESTUDIO agrupa as 14 guias operacionais e reaproveita a guia
// Geração de Vídeo, que usa o mesmo VideoStudio da rota isolada.
// Nenhum novo cabeçalho grande é acrescentado aqui.
export default function VideoEstudio() {
  return <AgenciaVideo embedded />;
}
