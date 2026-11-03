# Fluxo Git do frontend

Este repositório é separado do backend (ADR 0000, documentado no backend). Trabalhar em branch curta por passo, abrir PR para `main` e exigir o job `quality` verde com instalação congelada, formatação, lint, typecheck, testes e build. Revisão humana deve verificar interface, acessibilidade, fonte dos dados e ausência de segredos no bundle.

Quando houver publicação autorizada dos branches remotos, configurar em **Settings → Rules → Rulesets**: PR obrigatório, ao menos uma aprovação, status obrigatório `quality`, branch atualizado antes da mesclagem, sem force push nem exclusão de `main`. Verificar o nome do status após a primeira execução remota. O usuário proibiu push, e o remoto está vazio; a proteção e o CI hospedado seguem pendentes de evidência.

Mudanças coordenadas citam os commits dos dois repositórios em `backend/docs/implementation/PROGRESS.md`. Não mesclar ou implantar um frontend que apresente processos sem fonte oficial e revisão humana.
