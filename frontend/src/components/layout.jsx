import { useState } from 'react';
import Header from './header';
import Sidebar from './sidebar';
import Checkout from '../pages/Checkout';
import Inventory from '../pages/Inventory';
import Credit from '../pages/Credit';
import SalesReports from '../pages/SalesReports';
import Users from '../pages/Users';
import '../styles/layout.css';

function Layout({ onLogout, user, token }) {
	const [activePage, setActivePage] = useState('Checkout');
	const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

	const navigate = (page) => {
		if (page === 'Logout') {
			onLogout();
			return;
		}
		setActivePage(page);
	};

	return (
		<div className="dashboard-shell">
			<Sidebar
				activePage={activePage}
				onNavigate={navigate}
				collapsed={sidebarCollapsed}
				username={user?.username}
				role={user?.role}
				onToggle={() => setSidebarCollapsed((collapsed) => !collapsed)}
			/>
			<div className="dashboard-main">
				<Header />
				{activePage === 'Checkout' ? (
					<Checkout token={token} cashier={user?.username} />
				) : activePage === 'Inventory' ? (
					<Inventory token={token} role={user?.role} />
				) : activePage === 'Credit' ? (
					<Credit token={token} />
				) : activePage === 'Sales Reports' && user?.role === 'admin' ? (
					<SalesReports token={token} />
				) : activePage === 'User Access' && user?.role === 'admin' ? (
					<Users token={token} currentUser={user} />
				) : <div className="empty-page"><h2>{activePage}</h2><p>This section is ready for your next workflow.</p></div>}
			</div>
		</div>
	);
}

export default Layout;
