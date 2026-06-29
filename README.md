# Cadê meu livro? — Protótipo

Protótipo funcional do sistema de gestão de biblioteca "Cadê meu livro?",
cobrindo o escopo completo da especificação (Painel, Livros, Empréstimos,
Leitura, Anotações, Autenticação/2FA, Notificações, Renovação e Comunidade
de Leitores).

## Como rodar na sua máquina

### Pré-requisitos
- [Node.js](https://nodejs.org/) instalado (versão 18 ou superior). Para
  verificar se já tem instalado, abra o terminal e digite:
  ```
  node --version
  ```

### Passo a passo

1. Extraia este zip em uma pasta no seu computador.
2. Abra um terminal dentro dessa pasta.
3. Instale as dependências (só precisa fazer isso uma vez):
   ```
   npm install
   ```
4. Inicie o aplicativo:
   ```
   npm run dev
   ```
5. O terminal vai mostrar um endereço, normalmente:
   ```
   http://localhost:5173
   ```
   Abra esse endereço no navegador.

Para parar o aplicativo, volte ao terminal e pressione `Ctrl + C`.

## Contas de exemplo

Na tela de login, clique nos botões de "Contas de exemplo" para preencher
automaticamente, ou digite manualmente:

- **Leitor** — CPF `111.111.111-11`, senha `1234`
- **Administrador** — CPF `222.222.222-22`, senha `1234`

Depois do login, o sistema simula o envio do código de verificação (2FA):
o código aparece na própria tela (não é enviado de verdade por SMS/WhatsApp).

## O que é simulado neste protótipo

Como é um protótipo de validação de escopo, alguns pontos que dependeriam de
serviços externos reais foram simulados:

- **WhatsApp/SMS**: as mensagens não são enviadas de fato. Elas aparecem no
  "Log de Mensagens" (visível para o perfil Administrador), mostrando o que
  seria enviado, para quem e por qual gatilho.
- **Escanear Tombo/ISBN/Livro**: os botões de "Escanear" não acessam a
  câmera; eles preenchem o campo com um valor de exemplo, simulando uma
  leitura bem-sucedida.
- **Foto do livro**: o upload de imagem funciona de verdade (escolhe um
  arquivo do computador), mas fica salvo apenas no navegador.

## Onde os dados ficam salvos

Os dados (livros, empréstimos, usuários, etc.) ficam salvos no
`localStorage` do navegador — ou seja, salvos localmente, apenas
nesse navegador e nesse computador. Limpar o cache do navegador ou usar
outro navegador/computador reinicia os dados para o exemplo original.

Para reiniciar os dados manualmente a qualquer momento, use o botão
"Resetar dados de demonstração" na tela de login.

## Build de produção (opcional)

Se quiser gerar uma versão otimizada para publicar em um servidor:

```
npm run build
```

Isso cria uma pasta `dist/` com os arquivos finais, prontos para hospedar
em qualquer serviço de arquivos estáticos.

## Próximos passos (fora do escopo deste protótipo)

Este protótipo não tem um servidor/banco de dados real por trás — tudo
roda no navegador. Para uma versão de produção, será necessário substituir:

- A persistência local por um backend com banco de dados real.
- O login simulado por autenticação real, com senhas criptografadas.
- O envio simulado de mensagens pela integração real com a API Oficial
  do WhatsApp Business (e o provedor de SMS escolhido).
- O escaneamento simulado pela leitura real de câmera (Tombo/ISBN).
