import { useEffect, useState } from 'react';
import { apiRequest, handleProductImageError, productImageUrl } from '../services/api';
import '../styles/Checkout.css';

const formatPrice = (price) => Number(price || 0).toFixed(2);

function Checkout({ token, cashier }) {
	const [products, setProducts] = useState([]);
	const [categories, setCategories] = useState([]);
	const [activeCategory, setActiveCategory] = useState('All');
	const [searchTerm, setSearchTerm] = useState('');
	const [cart, setCart] = useState([]);
	const [paymentOpen, setPaymentOpen] = useState(false);
	const [paymentMethod, setPaymentMethod] = useState('Cash');
	const [amountTendered, setAmountTendered] = useState('');
	const [creditCustomer, setCreditCustomer] = useState({ name: '', phone: '', address: '' });
	const [receipt, setReceipt] = useState(null);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState('');
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let active = true;
		Promise.all([
			apiRequest('/api/products', token),
			apiRequest('/api/products/categories', token),
		])
			.then(([productRows, categoryRows]) => {
				if (!active) return;
				setProducts(productRows.map((product) => ({ ...product, price: Number(product.price) })));
				setCategories(categoryRows.map((category) => category.name));
			})
			.catch((loadError) => {
				if (active) setError(loadError.message);
			})
			.finally(() => {
				if (active) setLoading(false);
			});
		return () => { active = false; };
	}, [token]);

	const visibleProducts = products.filter((product) => (
		(activeCategory === 'All' || product.category === activeCategory)
		&& `${product.name} ${product.category} ${product.barcode || ''}`.toLowerCase().includes(searchTerm.toLowerCase().trim())
	));
	const total = Number(cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0).toFixed(2));
	const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
	const change = Math.max(0, Number((Number(amountTendered || 0) - total).toFixed(2)));
	const hasCreditDetails = creditCustomer.name.trim() && creditCustomer.phone.trim() && creditCustomer.address.trim();
	const canConfirmPayment = paymentMethod === 'Cash'
		? Number(amountTendered || 0) >= total
		: paymentMethod === 'Credit'
			? Boolean(hasCreditDetails)
			: true;

	const addToCart = (product) => {
		if (product.stock < 1) {
			setError(`${product.name} is out of stock.`);
			return;
		}
		setError('');
		setCart((current) => {
			const existing = current.find((item) => item.product.id === product.id);
			if (existing) {
				if (existing.quantity >= product.stock) {
					setError(`Only ${product.stock} units of ${product.name} are in stock.`);
					return current;
				}
				return current.map((item) => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
			}
			return [...current, { product, quantity: 1 }];
		});
	};

	const updateQuantity = (productId, delta) => {
		setCart((current) => current
			.map((item) => {
				if (item.product.id !== productId) return item;
				const nextQuantity = item.quantity + delta;
				return nextQuantity > item.product.stock ? item : { ...item, quantity: nextQuantity };
			})
			.filter((item) => item.quantity > 0));
	};

	const openPayment = () => {
		setError('');
		setAmountTendered('');
		setCreditCustomer({ name: '', phone: '', address: '' });
		setPaymentMethod('Cash');
		setPaymentOpen(true);
	};

	const confirmPayment = async () => {
		if (!canConfirmPayment || saving) return;
		setSaving(true);
		setError('');
		try {
			const sale = await apiRequest('/api/sales', token, {
				method: 'POST',
				body: JSON.stringify({
					items: cart.map(({ product, quantity }) => ({ productId: product.id, quantity })),
					paymentMethod,
					amountTendered: paymentMethod === 'Cash' ? Number(amountTendered) : null,
					customer: paymentMethod === 'Credit' ? creditCustomer : null,
				}),
			});
			const receiptItems = sale.items.map((item) => ({
				product: { name: item.product_name, price: Number(item.unit_price) },
				quantity: Number(item.quantity),
			}));
			setReceipt({
				items: receiptItems,
				total: Number(sale.total),
				paymentMethod: sale.payment_method,
				amountTendered: Number(sale.amount_tendered || 0),
				change: Number(sale.change_amount),
				creditCustomer: sale.customer,
				transactionId: sale.receipt_number,
				date: new Date(sale.created_at).toLocaleString('en-PH'),
			});
			setProducts((current) => current.map((product) => {
				const sold = cart.find((item) => item.product.id === product.id);
				return sold ? { ...product, stock: product.stock - sold.quantity } : product;
			}));
			setPaymentOpen(false);
		} catch (paymentError) {
			setError(paymentError.message);
		} finally {
			setSaving(false);
		}
	};

	const startNewTransaction = () => {
		setCart([]);
		setReceipt(null);
		setAmountTendered('');
		setCreditCustomer({ name: '', phone: '', address: '' });
	};

	const selectPaymentMethod = (method) => {
		setPaymentMethod(method);
		if (method !== 'Cash') setAmountTendered('');
		setError('');
	};

	return (
		<main className="checkout-workspace">
			<section className="products-panel" aria-labelledby="checkout-heading">
				<div className="checkout-toolbar">
					<h2 id="checkout-heading">Checkout</h2>
					<div className="sales-tools"><input aria-label="Search products" placeholder="Search product or scan barcode..." value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} /></div>
				</div>
				{error && <p className="checkout-error" role="alert">{error}</p>}
				<div className="category-list" aria-label="Product categories">
					{['All', ...categories].map((category) => <button className={activeCategory === category ? 'category active' : 'category'} key={category} type="button" onClick={() => setActiveCategory(category)}>{category}</button>)}
				</div>
				<div className="product-grid">
					{visibleProducts.map((product) => (
						<button className="product-card" type="button" key={product.id} disabled={product.stock < 1} onClick={() => addToCart(product)}>
							<img className="product-image" src={productImageUrl(product.image_url)} onError={handleProductImageError} alt="" />
							<strong>{product.name}</strong>
							<span className="product-meta"><b>₱{formatPrice(product.price)}</b><small>{product.stock} in stock</small></span>
						</button>
					))}
					{loading && <p>Loading products…</p>}
					{!loading && visibleProducts.length === 0 && <p>No products found.</p>}
				</div>
			</section>

			<aside className="cart-panel" aria-labelledby="cart-heading">
				<h2 id="cart-heading">Cart <span>({itemCount} items)</span></h2>
				<div className="cart-items">
					{cart.length === 0 ? <p>Cart is empty. Click a product to add.</p> : cart.map(({ product, quantity }) => (
						<div className="cart-item" key={product.id}>
							<div className="cart-item-info"><strong>{product.name}</strong><span>₱{formatPrice(product.price)} × {quantity}</span></div>
							<div className="cart-item-actions"><button type="button" aria-label={`Decrease ${product.name}`} onClick={() => updateQuantity(product.id, -1)}>-</button><span>{quantity}</span><button type="button" aria-label={`Increase ${product.name}`} onClick={() => updateQuantity(product.id, 1)}>+</button></div>
							<b>₱{formatPrice(product.price * quantity)}</b>
						</div>
					))}
				</div>
				<div className="cart-actions">
					<div className="cart-total"><strong>Total</strong><b>₱{formatPrice(total)}</b></div>
					<button className="checkout-button" type="button" disabled={cart.length === 0} onClick={openPayment}>Checkout</button>
					<button className="clear-cart-button" type="button" disabled={cart.length === 0} onClick={() => setCart([])}>Clear</button>
				</div>
			</aside>

			{paymentOpen && (
				<div className="checkout-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setPaymentOpen(false)}>
					<section className="payment-modal" role="dialog" aria-modal="true" aria-labelledby="payment-heading">
						<div className="payment-modal-header"><h2 id="payment-heading">Payment</h2><button type="button" aria-label="Close payment" onClick={() => setPaymentOpen(false)}>×</button></div>
						<div className="order-summary"><h3>Order Summary</h3>{cart.map(({ product, quantity }) => <div className="summary-row" key={product.id}><span>{product.name} ×{quantity}</span><b>₱{formatPrice(product.price * quantity)}</b></div>)}<div className="summary-total"><strong>Total</strong><b>₱{formatPrice(total)}</b></div></div>
						<label className="payment-label">Payment Method</label>
						<div className="payment-methods">{['Cash', 'GCash', 'Maya', 'Credit'].map((method) => <button className={paymentMethod === method ? 'payment-method active' : 'payment-method'} type="button" key={method} onClick={() => selectPaymentMethod(method)}>{method}</button>)}</div>
						{paymentMethod === 'Cash' && <>
							<label className="payment-label" htmlFor="amount-tendered">Amount Tendered</label>
							<input className="amount-input" id="amount-tendered" type="number" min={total} step="0.01" placeholder="₱0.00" value={amountTendered} onChange={(event) => setAmountTendered(event.target.value)} />
							{amountTendered && Number(amountTendered) >= total && <p className="change-message">Change: ₱{formatPrice(change)}</p>}
						</>}
						{paymentMethod === 'Credit' && <div className="credit-payment-fields">
							<p className="credit-payment-notice">This transaction will be recorded as credit. Please fill in the customer details.</p>
							<label className="payment-label" htmlFor="credit-customer-name">Customer Name</label><input className="amount-input" id="credit-customer-name" maxLength="200" placeholder="Full name" value={creditCustomer.name} onChange={(event) => setCreditCustomer({ ...creditCustomer, name: event.target.value })} />
							<label className="payment-label" htmlFor="credit-customer-phone">Phone Number</label><input className="amount-input" id="credit-customer-phone" maxLength="32" placeholder="09xxxxxxxxx" value={creditCustomer.phone} onChange={(event) => setCreditCustomer({ ...creditCustomer, phone: event.target.value })} />
							<label className="payment-label" htmlFor="credit-customer-address">Address</label><input className="amount-input" id="credit-customer-address" maxLength="500" placeholder="Street / Purok / Brgy." value={creditCustomer.address} onChange={(event) => setCreditCustomer({ ...creditCustomer, address: event.target.value })} />
						</div>}
						{error && <p className="checkout-error" role="alert">{error}</p>}
						<button className="confirm-payment-button" type="button" disabled={!canConfirmPayment || saving} onClick={confirmPayment}>{saving ? 'Saving…' : 'Confirm Payment'}</button>
					</section>
				</div>
			)}

			{receipt && (
				<div className="checkout-modal-backdrop receipt-backdrop" role="presentation">
					<section className="receipt-modal" role="dialog" aria-modal="true" aria-labelledby="receipt-heading">
						<h2 id="receipt-heading">Bili-Bili</h2>
						<p className="receipt-transaction">{receipt.transactionId}<br />{receipt.date}</p>
						<div className="receipt-items">{receipt.items.map(({ product, quantity }) => <div className="receipt-row" key={product.name}><span>{product.name} ×{quantity}</span><b>₱{formatPrice(product.price * quantity)}</b></div>)}</div>
						<div className="receipt-summary">
							<div><span>Total</span><b>₱{formatPrice(receipt.total)}</b></div><div><span>Method</span><span>{receipt.paymentMethod}</span></div>
							{receipt.paymentMethod === 'Cash' && <><div><span>Tendered</span><span>₱{formatPrice(receipt.amountTendered)}</span></div><div><span>Change</span><span>₱{formatPrice(receipt.change)}</span></div></>}
							{receipt.paymentMethod === 'Credit' && receipt.creditCustomer && <><div><span>Customer</span><span>{receipt.creditCustomer.name}</span></div><div><span>Phone</span><span>{receipt.creditCustomer.phone}</span></div></>}
							<div><span>Cashier</span><span>{cashier || 'Cashier'}</span></div>
						</div>
						<p className="receipt-thanks">Thank you for your purchase!</p>
						<button className="new-transaction-button" type="button" onClick={startNewTransaction}>New Transaction</button>
					</section>
				</div>
			)}
		</main>
	);
}

export default Checkout;
