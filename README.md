[![LinkedIn](https://img.shields.io/badge/LinkedIn-Connect-blue)](https://www.linkedin.com/in/hassenamri005/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)
[![Version](https://img.shields.io/badge/Version-1.0.0-yellow)](https://github.com/your-profile/your-repo/releases)

<div align="center">
  <h1> Nest JS React TS Boilerplate 🚀</h1>
  <p>A full-stack boilerplate integrating <b>Nest JS</b> and <b>React TS</b> with <b>Authentication</b>, <br/><b>Docker</b>, and <b>Docker Compose</b> for seamless development and production environments.</p>
  <img src="https://github.com/user-attachments/assets/2eb031ff-fdb7-42e2-90c6-74d893ed3943" alt="9ZR6vmf"/>
</div>

---

## Features

### Frontend (React TS)

- **React TS v18**: Modern React with TypeScript for type-safe development.
- **Routing Handling**: Efficient routing with role-based authentication.
  - **Role-Based Auth Routing**: Separate routes for **User** and **Admin** roles.
- **Persistent Redux Store**: State management with Redux for a consistent user experience.
- **Ant Design (Antd)**: UI library with a custom theme for a polished look.
- **Prebuilt Pages**:
  - Landing Page
  - Login Page
  - Admin Dashboard
  - User Dashboard
- **Docker Integration**:
  - `Dockerfile.dev`: For a fast and easy development environment.
  - `Dockerfile.prod`: For an optimized production environment.
- **Docker Compose**:
  - `docker-compose.yaml`: Simplifies setup for both development and production environments. Choose between `dev` or `prod` profiles.

### Backend (Nest JS)

- **Nest.js v10**: A progressive Node.js framework for building efficient and scalable server-side applications.
- **PostgreSQL**: A powerful, open-source relational database.
- **Prisma**: Modern ORM for database management.
- **JWT Authentication**: Secure authentication using access and refresh tokens.
- **Role-Based Access Control**: Guards for roles like **SUPERADMIN**, **ADMIN**, **USER**, and **OTHER**.
- **Swagger Integration**: Automatically generates API documentation and TypeScript client.
- **Docker Integration**:
  - `Dockerfile.dev`: For a fast and easy development environment.
  - `Dockerfile.prod`: For an optimized production environment.
- **Docker Compose**:
  - `docker-compose.dev.yaml`: For development.
  - `docker-compose.prod.yaml`: For production.

---

## Project Structure

```
nest-react-boilerplate/
├── frontend/              # React TS Frontend
│   ├── src/
│   ├── docker/
│   │    ├── Dockerfile.dev
│   │    └── Dockerfile.prod
│   ├── docker-compose.yaml
│   └── ...
├── backend/               # Nest JS Backend
│   ├── src/
│   ├── Dockerfile.dev
│   ├── Dockerfile.prod
│   ├── docker-compose.dev.yaml
│   ├── docker-compose.prod.yaml
│   └── ...
└── README.md
```

---

## Getting Started

### Prerequisites

- Docker and Docker Compose installed.
- Node.js and npm/yarn installed (for local development).

### Installation

1. Clone the repository:

   ```bash
   https://github.com/Hassenamri005/nest-react-boilerplate

   cd nest-react-boilerplate
   ```

2. Start all:

   - [**Gitpod**](https://www.gitpod.io/) :

     ```bash
     ./start_all_in_gitpod.sh
     ```

   - [**Github Codespace**](https://github.com/features/codespaces) :

     ```bash
     ./start_all_in_git_workspace.sh
     ```

3. Or manual local setup:

   **a. Backend**

   ```bash
   cd backend
   cp .env.example .env
   npm install
   docker-compose up --build -d
   npx prisma generate
   npx prisma migrate deploy
   npm run start:dev
   ```

   **b. Frontend**

   ```bash
   cd ../frontend
   cp .env.example .env
   npm install
   npm run dev
   ```

   Frontend API URL env key:

   ```bash
   VITE_API_URL=http://localhost:6001
   ```

## Frontend Routes

- `/`: Landing page.
- `/login`: Login page for authentication.
- `/user/dashboard`: Dashboard for authenticated users with the `user` role.
- `/admin/dashboard`: Dashboard for authenticated admins with the `admin` role.
- `*`: Fallback route for unhandled or incorrect paths.

### How to Create a New Route (Frontend)

1. **Create Your Page**:

   - Add your new page component in the `src/pages` directory.

2. **Update Routing**:

   - Open `App.tsx`.
   - Add your new route to either:
     - **Public Routes**: Accessible to all users.
     - **Private Routes**: Protected by role-based authentication.

3. **Role Guard**:
   - Ensure the route is protected by the appropriate role guard logic.

---

## Backend Features

### Swagger-TS Integration

- Used Library: [swagger-typescript-api](https://www.npmjs.com/package/swagger-typescript-api)
- Generates a TypeScript API client from the OpenAPI specification.
- Run the following command to generate the API client:
  ```bash
  npm run swagger:ts
  ```
- Copy the generated `src/api/myApi.ts` file to your frontend folder.

### Database Migrations

- Create a new migration:
  ```bash
  npx prisma migrate dev --name "init"
  ```
- Deploy migrations to the database:
  ```bash
  npx prisma migrate deploy
  ```
- Seed dummy data to the database:
  ```bash
  npx prisma db seed
  ```

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

## Additional Documentation

- Contribution guide: `CONTRIBUTING.md`
- Changelog policy: `CHANGELOG.md`
- Operations runbook: `docs/RUNBOOK.md`
