# Roteiro de teste — conta do Legado Car (19/10/2026)

## Iniciar o projeto

Abra o Docker Desktop. No terminal do Mac, dentro da pasta PI3-Docker, execute:

```bash
docker compose --env-file backend/PI3-API/.env -f docker-compose.yml -f docker-compose.resend.yml up -d
docker compose exec backend php artisan migrate
docker compose logs --tail=20 frontend
```

Quando aparecer Ready, abra http://127.0.0.1:3000. A API é http://localhost:8000/api.
As migrations já foram aplicadas; repetir migrate apenas confirma que estão atuais.
O scheduler desse comando cuida da fila de e-mail. Não é necessário rodar o PHP
instalado no Mac nem iniciar artisan schedule:work em outro terminal.

## O que testar

1. **Cadastro:** use uma conta de teste com e-mail que você possa consultar e um
   documento que ainda não esteja cadastrado. Peça o código, teste um código errado,
   depois confirme com o recebido. Conclua os dados: deve entrar direto na garagem.
2. **Identidade:** a saudação deve usar seu nome. Em Perfil → Dados pessoais,
   confira nome, e-mail e documento. Os campos estão somente para leitura, porque
   o backend ainda não possui atualização dos dados do próprio usuário.
3. **Sair:** Perfil → Acesso à conta → Sair da conta. Deve voltar ao login;
   recarregar /garagem sem sessão deve retornar ao login.
4. **Login:** tente senha incorreta, depois a correta. A primeira tentativa deve
   mostrar erro em português; a segunda abre a garagem. Recarregar mantém a sessão.
5. **Recuperação:** saia e clique Esqueci minha senha. Solicite o código, tente um
   incorreto e depois o correto. Ao chegar à nova senha, feche e reabra o modal:
   deve retomar a etapa de nova senha. Teste confirmação diferente, depois salve.
   A senha antiga deve parar de funcionar, e a nova deve permitir entrar.
6. **Reenvio:** durante os dois minutos de espera, o botão não deve enviar outra
   solicitação. Fechar/reabrir o modal não zera a espera. Após liberar, o novo
   código substitui o anterior.
7. **Sessão:** a renovação ocorre automaticamente no último minuto do JWT (o tempo
   é definido pela API). Nos testes automatizados, a API aceitou o token novo e
   rejeitou o anterior. Em rede indisponível, o app mostra aviso e permite repetir;
   uma sessão expirada exige novo login.
8. **Excluir:** use somente a conta de teste que você pretende remover. Perfil →
   Excluir conta → enviar código → validar → digitar DELETAR → confirmar. Deve
   voltar ao login com aviso de conta excluída; essa conta não deve conseguir
   entrar novamente. A confirmação é real, e não uma simulação.

## Observações para não confundir resultados

- Se acabou de criar/confirmar a conta, aguarde dois minutos antes de pedir
  recuperação para o mesmo e-mail: a API compartilha o controle de envio.
- A API limita tentativas. Se houver aviso de muitas tentativas, aguarde antes de
  repetir; várias etapas executadas muito rápido podem atingir esse limite.
- O recebimento depende do Resend e do remetente autorizado. Solicitar o código
  confirma a entrada na fila; confira a caixa de entrada, spam e painel do Resend.
- Termos e privacidade ainda têm texto provisório e não possuem endpoint oficial.
  Não são documentos finais aprovados pelo grupo.
- Veículos, gastos e manutenções da garagem ainda são dados de demonstração.
  A integração desses módulos está nas tarefas de outro integrante.

## Se algo falhar

Anote a etapa, o aviso mostrado e o horário. No navegador, a aba Network ajuda a
conferir o endpoint e status. Não compartilhe senhas, JWTs ou códigos de e-mail.
Para acompanhar os serviços:

```bash
docker compose logs --tail=30 backend webserver scheduler frontend
```

A integração está na branch feat/integracao-cadastro-email. As tarefas
relacionadas são #9, #12 e #13. A incorporação do pull request à main encerra
essas tarefas. Edição do perfil e documentos legais continuam como dependências.

Teste manual concluído pelo responsável em 20/10/2026 antes da revisão para publicação.
