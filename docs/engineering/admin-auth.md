# Acesso administrativo no frontend

O painel em `/admin` usa o fluxo OIDC Authorization Code com PKCE de um cliente público. `apps/web/src/environments/environment*.ts` aceita somente dados públicos: `authority`, `clientId`, `scope` e, se o provedor exigir, `audience`. Nenhum segredo de cliente ou chave de assinatura entra no bundle.

O provedor operacional permanece pendente no ADR 0035 do backend. Até sua configuração, `/admin/login` informa que o acesso não está disponível. Ao configurar o provedor, registrar a URI de retorno `<origem-do-site>/admin/callback` e habilitar CORS do endpoint de token para a origem do frontend. O `authority` deve corresponder ao issuer validado pela API; o audience do token de acesso deve corresponder a `ADMIN_AUTH_AUDIENCE`. A concessão de ADMIN/CURATOR continua na tabela `AdminUser` do servidor, vinculada a issuer + subject.

O token de acesso fica apenas na memória da aba. O estado temporário do redirecionamento fica em `sessionStorage` para validar o retorno OIDC. Recarregar a página exige nova entrada. O guard Angular apenas encaminha a navegação; cada endpoint administrativo continua exigindo autenticação e autorização no NestJS.
