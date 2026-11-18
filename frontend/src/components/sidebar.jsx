	function Sidebar({ activePage, onNavigate, collapsed, onToggle, username, role }) {
	const menuItems = [
		'Checkout',
		'Inventory',
		'Credit',
		...(role === 'admin' ? ['Sales Reports', 'User Access'] : [])
	];

	return (
			<aside className={collapsed ? 'app-sidebar collapsed' : 'app-sidebar'}>
			<button
				className="sidebar-brand"
				type="button"
				aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
				title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
				onClick={onToggle}
			>
				<img className="sidebar-mark" src="/bili.jpg" alt="" />
				<div className="sidebar-brand-copy">
					<strong>BILI-BILI</strong>
					<small>POS</small>
				</div>
			</button>

			<nav className="sidebar-nav" aria-label="Main navigation">
				{menuItems.map((item) => (
					<button
						className={activePage === item ? 'nav-item active' : 'nav-item'}
						key={item}
						type="button"
							title={collapsed ? item : undefined}
							aria-label={item}
						onClick={() => onNavigate(item)}
					>
						{item}
					</button>
				))}
			</nav>

			<div className="sidebar-account">
				<strong>{username || 'Cashier'}</strong>
				<span>{role === 'admin' ? 'Admin' : 'Cashier'}</span>
				<button type="button" onClick={() => onNavigate('Logout')}>Logout</button>
			</div>
		</aside>
	);
}

export default Sidebar;
