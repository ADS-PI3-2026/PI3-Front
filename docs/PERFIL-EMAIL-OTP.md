# Perfil e alteração de e-mail — interface

Alterações desenvolvidas na branch `feat/perfil-email-otp-desktop`:

- Senha e confirmação têm botões independentes no cadastro e na recuperação.
- O resumo do perfil mantém nome e avatar lado a lado no desktop; nomes longos quebram linha dentro do espaço disponível.
- CPF e CNPJ são exibidos com as máscaras existentes do cadastro, incluindo CNPJ alfanumérico.
- Somente o e-mail tem ação de edição: campo destacado e botão de lápis. Nome e documento continuam somente para leitura.
- O modal pede o novo e-mail, valida o formato e rejeita o endereço atual. A segunda etapa reutiliza VerificationCodeFields.
- CPF: confirmação do e-mail atual e do novo; CNPJ: confirmação somente do novo.
- AppShell e AdminShell usam LoadingScreen com o texto Carregando, spinner e respeito à preferência de movimento reduzido.
- O resumo de gastos respeita o padding lateral dos percentuais em cards estreitos, e a linha abaixo do cabeçalho foi removida.

## Limite atual, confirmado com o responsável

O backend da troca de e-mail ainda será implementado. O modal é uma prévia da
interface: continuar apenas apresenta os campos de OTP; não faz requisições,
não envia códigos, não valida códigos e não muda o usuário ou a sessão.
Os campos de código e a confirmação permanecem desabilitados até a integração.
Por orientação de interface, não são exibidos avisos de prévia ou de rotas pendentes.

Quando os endpoints estiverem disponíveis, devem ser conectados o envio,
validação de todos os códigos exigidos pelo tipo de conta e a gravação efetiva.
O e-mail mostrado no perfil só deve mudar após confirmação de sucesso da API.

## Conferência manual

1. No cadastro, mostrar uma senha deve manter o outro campo oculto; repetir na recuperação.
2. Abrir Perfil no desktop e conferir posição do nome, máscara do documento e destaque do e-mail.
3. Clicar no lápis; testar e-mail inválido, igual ao atual e um endereço novo.
4. Conferir dois grupos de OTP para CPF e somente um para CNPJ. A prévia não deve enviar e-mails nem permitir salvar a alteração.
5. Testar Voltar, fechar pelo botão, Escape e navegação por Tab; ao fechar, o foco volta para o lápis.
6. Repetir em viewport móvel: modal deve caber na tela e rolar quando necessário.
