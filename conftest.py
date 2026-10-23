"""Configuração comum a todas as suítes (backend/tests e tests/).

ENVIRONMENT não tem mais padrão na aplicação (falha fechada quando ausente). Os testes
rodam como ``test`` quando o processo não define outro valor; o CI já exporta
ENVIRONMENT=test. Isso vale só para a execução do pytest, nunca para a API.
"""

import os

os.environ.setdefault("ENVIRONMENT", "test")
