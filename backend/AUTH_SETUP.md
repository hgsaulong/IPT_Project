# Bili-Bili Login Setup

Login uses bcrypt hashes in the existing MySQL `users.password` column and JWT access tokens. Passwords and hashes are never returned by the login endpoint or `/users` route.

## Create the database tables and sample data

Run `backend/database.sql` in MySQL Workbench or phpMyAdmin. It creates the `bili_bili` database and all required tables, adds `products.image_url` to older databases, and seeds categories, sample products, customers, and 60 synthetic sales dated from 60 days ago through yesterday. The script is safe to rerun and does not drop existing user or product data. Demo sales/customers are test data; do not import them into a live accounting database. A cashier account must exist before running the script to seed historical sales.

## Configure the signing key

Create a private `backend/.env` file (do not commit it) and set `AUTH_TOKEN_SECRET` to a long random value. For PowerShell, a random value can be generated without displaying it using:

```powershell
$bytes = [byte[]]::new(48); [Security.Cryptography.RandomNumberGenerator]::Fill($bytes); "AUTH_TOKEN_SECRET=$([Convert]::ToBase64String($bytes))" | Set-Content .env
```

## Seed the cashier accounts

From the `backend` directory, run:

```powershell
npm run seed:users
```

The script prompts privately for a password for each username listed in `backend/seed-users.js`. Choose any non-empty password up to 200 characters. Terminal input is hidden, and only bcrypt hashes are stored. Existing usernames are skipped and their passwords are not changed.

## Start the app services

Set the database connection values in `backend/.env` (see `.env.example`). Start the backend from `backend` with `npm start`, then start the frontend from `frontend` with `npm start`. The frontend sends credentials to `http://localhost:3001/api/auth/login`; set `REACT_APP_API_URL` if the backend uses a different base URL.

Product images are served by the frontend from `frontend/public`. The SQL seed uses the sample images already in that folder. Uploaded images are saved under `frontend/public/uploads/products` and stored in the database with a public path such as `/uploads/products/<filename>.jpg`. The product-image endpoint accepts JPEG, PNG, and WebP files up to 5 MB, and the frontend uses `/images/product-placeholder.svg` if an image cannot be found.
