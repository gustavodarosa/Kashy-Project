# 🚀 Kashy Project — Dashboard E-Commerce & Gerenciamento de Carteiras BCH

[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)  
[![Node.js](https://img.shields.io/badge/Node.js-v16%2B-brightgreen.svg)](https://nodejs.org/)  
[![MongoDB](https://img.shields.io/badge/MongoDB-v5.x-brightgreen.svg)](https://www.mongodb.com/)  
[![React](https://img.shields.io/badge/React-v18.x-blue.svg)](https://react.dev/)  
[![Status](https://img.shields.io/badge/status-em%20desenvolvimento-orange)]()

---

## 📁 Sumário
- [Sobre o Projeto](#-sobre-o-projeto)
- [Funcionalidades](#-funcionalidades)
- [Tecnologias Utilizadas](#-tecnologias-utilizadas)
- [Estrutura do Projeto](#-estrutura-do-projeto)
- [Como Executar](#-como-executar)
- [Testes](#-testes)
- [Documentação da API](#-documentação-da-api)
- [Quadro de Funcionalidades](#-quadro-de-funcionalidades)
- [Segurança](#-segurança)
- [Melhorias Futuras](#-melhorias-futuras)
- [Contribuição](#-contribuição)
- [Contato](#-contato)
- [Licença](#-licença)

---

## 📌 Sobre o Projeto

O **Kashy Project** é uma plataforma completa que integra:
- 🛒 **Dashboard de E-commerce**  
- 🏦 **Gerenciamento de Carteiras Bitcoin Cash (BCH)**

Facilitando a gestão de negócios com pagamentos rápidos, transparentes e seguros através da blockchain.

---

## 📋 Funcionalidades

### 🛒 E-commerce
- Cadastro e gerenciamento de produtos
- Análises de vendas e estoque
- Gestão de clientes e usuários
- Notificações em tempo real

### 💸 Carteira BCH
- Consulta de saldo disponível e pendente
- Envio e recebimento via QR Code
- Histórico completo de transações
- Alertas automáticos de movimentações

### 🔐 Segurança e Autenticação
- Registro e login com proteção JWT
- Dados sensíveis criptografados com AES-256
- Atualização de senha e username

---

## 🛠️ Tecnologias Utilizadas

### Frontend
- ⚛️ React + TypeScript
- 🎨 Tailwind CSS
- 📊 Chart.js
- 🔥 Socket.IO (notificações em tempo real)
- ⚡ Vite

### Backend
- 🖥️ Node.js + Express
- 🛢️ MongoDB + Mongoose
- 🔑 JWT + Bcrypt para autenticação
- 💰 bch-js (Bitcoin Cash API), Fulcrum, Blockchair
- 🔒 Criptografia AES-256

### Infraestrutura
- 🐳 Docker
- 📈 API CoinGecko (dados de mercado)

---

## 📂 Estrutura do Projeto

```bash
Kashy-Project/
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   ├── middlewares/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── utils/
│   │   └── app.js
│   ├── package.json
│   └── docker-compose.yml
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── utils/
│   │   └── App.tsx
│   ├── public/
│   ├── package.json
│   └── vite.config.ts
└── README.md
```

---

## 🚀 Como Executar

### Pré-requisitos
- Node.js (v16+)
- Docker (opcional)
- MongoDB (local ou Atlas)

### Clone o repositório

```bash
git clone https://github.com/seu-usuario/kashy-project.git
cd kashy-project
```

### Configurar o Backend

```bash
cd backend
```

Crie um `.env`:

```env
MONGO_URI=mongodb://localhost:27017/kashy
JWT_SECRET=sua-chave-secreta
ENCRYPTION_KEY=sua-chave-de-criptografia
```

Instale as dependências e inicie o servidor:

```bash
npm install
npm run dev
```

### Configurar o Frontend

```bash
cd ../frontend
```

Instale as dependências e inicie:

```bash
npm install
npm run dev
```

### Acesse
- Frontend: [http://localhost:5173](http://localhost:5173)
- Backend API: [http://localhost:3000](http://localhost:3000)

---

## 🧪 Testes

### Backend
- Testes unitários e de integração: **Jest** + **Supertest**

Rodar testes:

```bash
npm test
```

### Frontend
- Em planejamento para usar **Jest** + **React Testing Library**

---

## 📖 Documentação da API

| Método | Endpoint                  | Descrição                          |
|:-------|:---------------------------|:-----------------------------------|
| POST   | `/api/auth/login`           | Login de usuário                   |
| POST   | `/api/auth/register`        | Cadastro de novo usuário           |
| GET    | `/api/wallet`               | Consulta da carteira               |
| POST   | `/api/wallet/send`          | Envio de Bitcoin Cash              |
| GET    | `/api/user/:id`             | Consulta informações do usuário    |
| PUT    | `/api/user/update-username` | Atualizar username                 |
| PUT    | `/api/user/update-password` | Atualizar senha                    |

---

## 📊 Quadro de Funcionalidades

| Funcionalidade                  | Status            |
|:---------------------------------|:------------------|
| Cadastro/Login de Usuários       | ✅ Completo        |
| Gerenciamento de Produtos        | ✅ Completo        |
| Relatórios de Vendas             | ✅ Completo        |
| Integração com Bitcoin Cash      | ✅ Completo        |
| Sistema de Notificações          | 🔄 Em desenvolvimento |
| Testes Automatizados Frontend    | 🔜 Planejado       |
| Deploy em Produção               | 🔜 Planejado       |

---

## 🛡️ Segurança
- 🔒 Criptografia AES-256 para dados críticos
- 🔑 Tokens JWT para autenticação
- 🧹 Sanitização e validação rigorosa de dados

---

## 📈 Melhorias Futuras
- Suporte a múltiplas criptos (ETH, LTC)
- Melhorias de UX e acessibilidade
- Integração com PIX/fiat automático
- Testes end-to-end Cypress

---

## 🤝 Contribuição

Contribuições são super bem-vindas!

1. Faça um fork 🍴
2. Crie sua branch (`git checkout -b minha-feature`)
3. Commit suas mudanças (`git commit -m 'feat: minha feature'`)
4. Push (`git push origin minha-feature`)
5. Abra um Pull Request 📩

---

## 📢 Contato
- Gustavo da Rosa — [gustavodarosa2002@gmail.com](mailto:gustavodarosa2002@gmail.com)
- Natan Bagatoli — [natanfbagatoli@gmail.com](mailto:natanfbagatoli@gmail.com)

---

## 📄 Licença
Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.