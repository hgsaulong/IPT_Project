import { useState } from 'react';
import '../styles/login.css';

function Login({ onLogin }) {
	const [username, setUsername] = useState('');
	const [password, setPassword] = useState('');
	const [passwordVisible, setPasswordVisible] = useState(false);
	const [error, setError] = useState('');
	const [isSubmitting, setIsSubmitting] = useState(false);

	const handleSubmit = async (event) => {
		event.preventDefault();
		setError('');
		setIsSubmitting(true);

		try {
			const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:3001'}/api/auth/login`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ username, password }),
			});
			const result = await response.json();
			if (!response.ok) throw new Error(result.message || 'Unable to sign in.');
			onLogin(result);
		} catch (loginError) {
			setError(loginError.message === 'Failed to fetch' ? 'Unable to connect to the login server.' : loginError.message);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<main className="login-page">
			<section className="login-brand" aria-label="Bili-Bili Point of Sale System">
				<h1>Bili-Bili</h1>
				<p>Point of Sale System</p>
				<p className="brand-description">
					Manage your store with ease — sales, inventory, and credit all in one place.
				</p>
			</section>

			<section className="login-card" aria-labelledby="login-heading">
				<div className="login-content">
					<h2 id="login-heading">Log In</h2>
					<p className="login-intro">Enter your credentials to get started.</p>

					<form onSubmit={handleSubmit}>
						<div className="form-field">
							<label htmlFor="username">Username</label>
							<input
								id="username"
								name="username"
								type="text"
								placeholder="Enter username"
								autoComplete="username"
								value={username}
								onChange={(event) => setUsername(event.target.value)}
								required
							/>
						</div>

						<div className="form-field">
							<label htmlFor="password">Password</label>
							<div className="password-input-wrap">
								<input
									id="password"
									name="password"
									type={passwordVisible ? 'text' : 'password'}
									placeholder="Enter password"
									autoComplete="current-password"
									value={password}
									onChange={(event) => setPassword(event.target.value)}
									required
								/>
								<button
									className="password-toggle"
									type="button"
									aria-label={passwordVisible ? 'Hide password' : 'Show password'}
									aria-pressed={passwordVisible}
									onClick={() => setPasswordVisible((visible) => !visible)}
								>
									{passwordVisible ? (
										<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8" /><path d="M9.9 5.2A10.8 10.8 0 0112 5c5 0 8.5 4.3 9.5 6.1a1.7 1.7 0 010 1.8 14 14 0 01-3.1 3.5M6.2 6.3A14.6 14.6 0 002.5 11a1.7 1.7 0 000 2 11.1 11.1 0 009.5 5 10.4 10.4 0 003-.4" /></svg>
									) : (
										<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.4-7 9.5-7 9.5 7 9.5 7-3.4 7-9.5 7-9.5-7-9.5-7z" /><circle cx="12" cy="12" r="3" /></svg>
									)}
								</button>
							</div>
						</div>

						{error && <p className="login-error" role="alert">{error}</p>}
						<button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Signing In...' : 'Log In'}</button>
					</form>

					<footer className="login-footer">© 2026 Bili-Bili POS · All rights reserved</footer>
				</div>
			</section>
		</main>
	);
}

export default Login;
