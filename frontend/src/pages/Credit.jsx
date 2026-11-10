import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../services/api';
import '../styles/Credit.css';

const formatMoney = (amount) => `₱${Number(amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatDate = (value) => {
	if (!value) return '—';
	const dateText = typeof value === 'string' ? value.slice(0, 10) : new Date(value).toISOString().slice(0, 10);
	return new Date(`${dateText}T00:00:00`).toLocaleDateString('en-PH');
};

function Credit({ token }) {
	const [customers, setCustomers] = useState([]);
	const [selectedId, setSelectedId] = useState(null);
	const [history, setHistory] = useState([]);
	const [searchTerm, setSearchTerm] = useState('');
	const [paymentOpen, setPaymentOpen] = useState(false);
	const [paymentAmount, setPaymentAmount] = useState('');
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState('');

	useEffect(() => {
		let active = true;
		apiRequest('/api/credit/customers', token)
			.then((rows) => {
				if (!active) return;
				setCustomers(rows);
				setSelectedId((current) => rows.some((customer) => String(customer.id) === String(current)) ? current : (rows[0]?.id ?? null));
			})
			.catch((loadError) => {
				if (active) setError(loadError.message);
			})
			.finally(() => {
				if (active) setLoading(false);
			});
		return () => { active = false; };
	}, [token]);

	useEffect(() => {
		if (!selectedId) {
			setHistory([]);
			return;
		}
		apiRequest(`/api/credit/customers/${selectedId}/history`, token)
			.then(setHistory)
			.catch((loadError) => setError(loadError.message));
	}, [selectedId, token]);

	const selectedCustomer = customers.find((customer) => String(customer.id) === String(selectedId)) || null;
	const filteredCustomers = useMemo(() => customers.filter((customer) => (
		`${customer.name} ${customer.phone}`.toLowerCase().includes(searchTerm.toLowerCase().trim())
	)), [customers, searchTerm]);
	const outstanding = customers.reduce((sum, customer) => sum + Number(customer.balance), 0);

	const recordPayment = async (event) => {
		event.preventDefault();
		if (!selectedCustomer) return;
		setSaving(true);
		setError('');
		try {
			await apiRequest('/api/credit/payments', token, {
				method: 'POST',
				body: JSON.stringify({ customerId: selectedCustomer.id, amount: Number(paymentAmount) }),
			});
			const rows = await apiRequest('/api/credit/customers', token);
			setCustomers(rows);
			setSelectedId((current) => rows.some((customer) => String(customer.id) === String(current)) ? current : (rows[0]?.id ?? null));
			setHistory(await apiRequest(`/api/credit/customers/${selectedCustomer.id}/history`, token));
			setPaymentAmount('');
			setPaymentOpen(false);
		} catch (paymentError) {
			setError(paymentError.message);
		} finally {
			setSaving(false);
		}
	};

	return (
		<main className="credit-page">
			<section className="credit-customers">
				<header className="credit-list-heading">
					<div><h1>Credit</h1><p>Total outstanding: <strong>{formatMoney(outstanding)}</strong></p></div>
				</header>
				{error && <p className="credit-error" role="alert">{error}</p>}
				<input className="customer-search" aria-label="Search customer" placeholder="Search customer..." value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} />
				<div className="customer-list">
					{filteredCustomers.map((customer) => (
						<button className={String(selectedId) === String(customer.id) ? 'customer-card active' : 'customer-card'} type="button" key={customer.id} onClick={() => setSelectedId(customer.id)}>
							<span><strong>{customer.name}</strong><small>{customer.phone}</small></span>
							{Number(customer.balance) > 0 ? <b>{formatMoney(customer.balance)}</b> : <b className="paid-badge">Paid</b>}
						</button>
					))}
					{loading && <p className="history-empty">Loading credit accounts…</p>}
					{!loading && filteredCustomers.length === 0 && <p className="history-empty">No credit accounts found.</p>}
				</div>
			</section>

			<section className="credit-details">
				{selectedCustomer ? <>
					<header className="customer-detail-heading">
						<div><h2>{selectedCustomer.name}</h2><p>{selectedCustomer.phone}<br />{selectedCustomer.address}</p></div>
						<button className="record-payment-button" type="button" disabled={Number(selectedCustomer.balance) <= 0} onClick={() => setPaymentOpen(true)}>Record<br />Payment</button>
					</header>
					<div className="balance-panel"><div><label>Current Balance</label><strong>{formatMoney(selectedCustomer.balance)}</strong></div><p>Last purchase<br /><b>{formatDate(selectedCustomer.lastPurchase)}</b></p></div>
					<div className="credit-history">
						<div className="history-head"><span>Date</span><span>Description</span><span>Type</span><span>Amount</span></div>
						{history.length === 0 ? <p className="history-empty">No credit history yet.</p> : history.map((entry, index) => <div className="history-row" key={`${entry.date}-${index}`}><span>{formatDate(entry.date)}</span><span>{entry.description}</span><span className={entry.type === 'PAYMENT' ? 'payment-tag' : 'credit-tag'}>{entry.type}</span><b className={entry.type === 'PAYMENT' ? 'payment-amount' : ''}>{entry.type === 'PAYMENT' ? '−' : '+'}{formatMoney(Math.abs(Number(entry.amount)))}</b></div>)}
					</div>
				</> : <p className="history-empty">{loading ? 'Loading credit accounts…' : 'No customers have credit sales yet.'}</p>}
			</section>

			{paymentOpen && selectedCustomer && <div className="credit-modal-backdrop" role="presentation"><form className="credit-modal" onSubmit={recordPayment}><div className="credit-modal-heading"><h2>Record Payment</h2><button type="button" aria-label="Close" onClick={() => setPaymentOpen(false)}>×</button></div><p>Balance: {formatMoney(selectedCustomer.balance)}</p><label>Payment Amount (₱)<input autoFocus required type="number" min="0.01" max={selectedCustomer.balance} step="0.01" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} /></label><div className="credit-modal-actions"><button className="record-payment-button" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Confirm Payment'}</button><button type="button" onClick={() => setPaymentOpen(false)}>Cancel</button></div></form></div>}
		</main>
	);
}

export default Credit;
