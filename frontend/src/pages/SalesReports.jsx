import { useEffect, useState } from 'react';
import { apiRequest } from '../services/api';
import '../styles/SalesReports.css';

const formatMoney = (amount) => `₱${Number(amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dateOnly = (value) => typeof value === 'string' ? value.slice(0, 10) : new Date(value).toISOString().slice(0, 10);
const localDateOnly = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const formatDay = (value) => {
	const dateText = dateOnly(value);
	return new Date(`${dateText}T00:00:00`).toLocaleDateString('en-PH', { weekday: 'short', day: 'numeric' });
};
const displayEnd = (value) => {
	const date = new Date(`${dateOnly(value)}T00:00:00`);
	date.setDate(date.getDate() - 1);
	return localDateOnly(date);
};

function SalesReports({ token }) {
	const [range, setRange] = useState('Today');
	const [report, setReport] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');

	useEffect(() => {
		setLoading(true);
		setError('');
		apiRequest(`/api/reports/sales?range=${encodeURIComponent(range)}`, token)
			.then(setReport)
			.catch((loadError) => setError(loadError.message))
			.finally(() => setLoading(false));
	}, [range, token]);

	const dailySales = report?.dailySales || [];
	const paymentMethods = report?.paymentMethods || [];
	const maxSales = Math.max(1, ...dailySales.map((entry) => entry.total));
	const paymentTotal = paymentMethods.reduce((sum, method) => sum + method.amount, 0);

	return (
		<main className="reports-page">
			<header className="reports-heading">
				<div>
					<h1>Sales Reports</h1>
					<p>{report ? `${report.start.slice(0, 10)} – ${displayEnd(report.end)}` : 'Sales from your database'}</p>
				</div>
				<select aria-label="Report range" value={range} onChange={(event) => setRange(event.target.value)}>
					<option>Today</option>
					<option>This Week</option>
					<option>This Month</option>
				</select>
			</header>

			{error && <p className="reports-error" role="alert">{error}</p>}
			{loading && <p>Loading sales report…</p>}
			{report && <>
				<section className="report-summary-grid" aria-label="Sales summary">
					<div className="report-summary-card"><label>Total Sales</label><strong>{formatMoney(report.summary.totalSales)}</strong></div>
					<div className="report-summary-card"><label>Transactions</label><strong className="plain-number">{report.summary.transactions.toLocaleString('en-PH')}</strong></div>
					<div className="report-summary-card"><label>Avg. Basket</label><strong>{formatMoney(report.summary.averageBasket)}</strong></div>
					<div className="report-summary-card"><label>Weekly Total</label><strong>{formatMoney(report.summary.weeklyTotal)}</strong></div>
				</section>

				<section className="report-content-grid">
					<div className="weekly-report-panel">
						<h2>Daily Sales · {range}</h2>
						{dailySales.length === 0 ? <p className="report-empty">No sales recorded in this period.</p> : <div className="weekly-chart">
							{dailySales.map((entry) => <div className="chart-column" key={entry.date}><div className="chart-bar-track"><span className="chart-bar" style={{ height: `${Math.max(3, (entry.total / maxSales) * 100)}%` }} /></div><span>{formatDay(entry.date)}</span><b>{formatMoney(entry.total)}</b></div>)}
						</div>}
					</div>

					<div className="payment-report-panel">
						<h2>Payment Methods</h2>
						{paymentMethods.length === 0 ? <p className="report-empty">No payments recorded in this period.</p> : <div className="payment-report-list">
							{paymentMethods.map((method) => {
								const percentage = paymentTotal ? Math.round((method.amount / paymentTotal) * 100) : 0;
								return <div className="payment-report-item" key={method.name}><div><strong>{method.name}</strong><span>{formatMoney(method.amount)} <b>· {percentage}%</b></span></div><div className="payment-progress"><i style={{ width: `${percentage}%` }} /></div></div>;
							})}
						</div>}
					</div>
				</section>
				{report.monthlySales.length > 0 && <section className="monthly-breakdown"><h2>Monthly Breakdown</h2><div>{report.monthlySales.map((month) => <p key={month.month}><strong>{new Date(`${month.month}-01T00:00:00`).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })}</strong><span>{formatMoney(month.total)} · {month.transactions} transactions</span></p>)}</div></section>}
			</>}
		</main>
	);
}

export default SalesReports;
