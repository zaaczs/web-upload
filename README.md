# Sistema de Cadastro com Login

Sistema web responsivo com:
- login por usuário
- cadastro de pessoas com foto
- galeria por usuário (isolada)
- exportação em PDF
- persistência em PostgreSQL

## Usuários já cadastrados (seed automático)

- Usuário: `Iure` | Senha: `123456`
- Usuário: `Aecio` | Senha: `123456`
- Usuário: `Jairo` | Senha: `123456`

Esses usuários são criados automaticamente no startup do servidor (incluindo produção no Heroku).

## Rodar localmente

1. Instale as dependências:
   - `npm install`
2. Configure variáveis de ambiente em `.env`:
   - `DATABASE_URL=postgres://...`
   - `JWT_SECRET=troque-esta-chave`
3. Inicie:
   - `npm start`
4. Acesse:
   - `http://localhost:3000`

## Deploy no Heroku

1. Crie o app:
   - `heroku create`
2. Adicione PostgreSQL:
   - `heroku addons:create heroku-postgresql:essential-0`
3. Configure segredo JWT:
   - `heroku config:set JWT_SECRET=troque-para-um-valor-forte`
4. Deploy:
   - `git push heroku main`

Ao subir, o app cria as tabelas e garante os 3 usuários automaticamente.
