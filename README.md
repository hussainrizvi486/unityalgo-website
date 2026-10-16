# UnityAlgo — Website & Cloud Platform

This repository contains the official **UnityAlgo Website & Cloud Platform**, built using modern technologies to deliver a scalable, secure, and reliable software experience.

### Tech Stack

- **Backend:** Python, Flask
- **Frontend:** Next.js, TypeScript
- **Database:** PostgreSQL

## Getting Started

Follow the steps below to set up the project for local development.

### 1. Clone the Repository

Clone the repository and navigate to the project directory.

```bash
git clone https://github.com/hussainrizvi486/unityalgo-website
cd unityalgo-website
```

### 2. Install Frontend Dependencies

Install the required Node.js packages.

```bash
npm install
```

### 3. Set Up the Python Environment

Navigate to the controller directory and create a Python virtual environment.

```bash
cd controller
python -m venv venv
```

Activate the virtual environment.

**Linux / macOS:**
```bash
source venv/bin/activate
```

**Windows:**
```bash
venv\Scripts\activate
```

Install the required Python packages.

```bash
pip install -r requirements.txt
```

### 4. Configure Environment Variables

Set up the required environment variables for both the **Next.js frontend** and **Flask controller**.

Create the appropriate `.env` files using the project's environment configuration examples, if available.

Configure the necessary settings, including:

- Database connection
- API endpoints
- Application secrets
- Other required service configurations

### 5. Set Up PostgreSQL

Ensure PostgreSQL is installed and running.

Create the development database and configure the connection credentials in the controller's environment file.

### 6. Start the Development Servers

**Next.js Frontend**

From the frontend project directory, run:

```bash
npm run dev
```

**Flask Controller**

From the controller directory, activate the Python virtual environment and start the Flask development server:

```bash
py main.py server
```

Ensure both services are configured to communicate through the appropriate API endpoints.

## Development Notes

- Keep dependencies up to date.
- Never commit `.env` files or sensitive credentials.
- Use separate environment configurations for development and production.
- Ensure PostgreSQL is running before starting backend services.

**UnityAlgo** — Building smarter, scalable business solutions.