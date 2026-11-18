import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../services/api';
import '../styles/Users.css';

function Users({ token, currentUser }) {
	const [users, setUsers] = useState([]);
	const [form, setForm] = useState({ username: '', password: '', role: 'cashier' });
	const [editingId, setEditingId] = useState(null);
	const [passwordVisible, setPasswordVisible] = useState(false);
	const [error, setError] = useState('');
	const [saving, setSaving] = useState(false);

	const loadUsers = useCallback(() => apiRequest('/api/users', token).then(setUsers).catch((loadError) => setError(loadError.message)), [token]);
	useEffect(() => { loadUsers(); }, [loadUsers]);

	const submit = async (event) => {
		event.preventDefault();
		setSaving(true);
		setError('');
		try {
			const body = editingId
				? { role: form.role, ...(form.password ? { password: form.password } : {}) }
				: form;
			await apiRequest(editingId ? `/api/users/${editingId}` : '/api/users', token, {
				method: editingId ? 'PUT' : 'POST',
				body: JSON.stringify(body),
			});
			setForm({ username: '', password: '', role: 'cashier' });
			setEditingId(null);
			await loadUsers();
		} catch (saveError) {
			setError(saveError.message);
		} finally {
			setSaving(false);
		}
	};

	const edit = (user) => {
		setEditingId(user.id);
		setPasswordVisible(false);
		setForm({ username: user.username, password: '', role: user.role });
	};

	const remove = async (user) => {
		if (!window.confirm(`Remove ${user.username}?`)) return;
		try {
			await apiRequest(`/api/users/${user.id}`, token, { method: 'DELETE' });
			await loadUsers();
		} catch (deleteError) {
			setError(deleteError.message);
		}
	};

	return (
		<main className="users-page">
			<header className="users-heading"><div><h1>User Access</h1><p>Manage authorized store staff and cashier accounts.</p></div></header>
			{error && <p className="users-error" role="alert">{error}</p>}
			<form className="user-form" onSubmit={submit}>
				<h2>{editingId ? 'Edit User' : 'Add User'}</h2>
				{!editingId && <label>Username<input required maxLength="100" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} /></label>}
				<label>{editingId ? <>New Password <small>(optional)</small></> : 'Password'}<span className="user-password-field"><input required={!editingId} type={passwordVisible ? 'text' : 'password'} maxLength="200" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /><button type="button" className="user-password-toggle" aria-label={passwordVisible ? 'Hide password' : 'Show password'} aria-pressed={passwordVisible} onClick={() => setPasswordVisible((visible) => !visible)}>{passwordVisible ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8" /><path d="M9.9 5.2A10.8 10.8 0 0112 5c5 0 8.5 4.3 9.5 6.1a1.7 1.7 0 010 1.8 14 14 0 01-3.1 3.5M6.2 6.3A14.6 14.6 0 002.5 11a1.7 1.7 0 000 2 11.1 11.1 0 009.5 5 10.4 10.4 0 003-.4" /></svg> : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.4-7 9.5-7 9.5 7 9.5 7-3.4 7-9.5 7-9.5-7-9.5-7z" /><circle cx="12" cy="12" r="3" /></svg>}</button></span></label>
				<label>Role<select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}><option value="cashier">Cashier</option><option value="admin">Admin</option></select></label>
				<div className="user-form-actions"><button type="submit" disabled={saving}>{saving ? 'Saving...' : editingId ? 'Save Changes' : 'Add User'}</button>{editingId && <button type="button" onClick={() => { setEditingId(null); setForm({ username: '', password: '', role: 'cashier' }); }}>Cancel</button>}</div>
			</form>
			<section className="users-table-wrap"><table className="users-table"><thead><tr><th>Username</th><th>Role</th><th>Actions</th></tr></thead><tbody>{users.map((user) => <tr key={user.id}><td>{user.username}{user.id === currentUser.id ? ' (You)' : ''}</td><td>{user.role}</td><td><button type="button" onClick={() => edit(user)}>Edit</button>{user.id !== currentUser.id && <button type="button" onClick={() => remove(user)}>Remove</button>}</td></tr>)}</tbody></table></section>
		</main>
	);
}

export default Users;
