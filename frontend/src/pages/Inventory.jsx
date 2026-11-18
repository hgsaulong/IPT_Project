import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiRequest, handleProductImageError, productImageUrl } from '../services/api';
import '../styles/Inventory.css';

function Inventory({ token, role }) {
	const isAdmin = role === 'admin';
	const [products, setProducts] = useState([]);
	const [categories, setCategories] = useState([]);
	const [searchTerm, setSearchTerm] = useState('');
	const [category, setCategory] = useState('All');
	const [modal, setModal] = useState(null);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState('');
	const [selectedImageName, setSelectedImageName] = useState('');

	const loadInventory = useCallback(async () => {
		const [productRows, categoryRows] = await Promise.all([
			apiRequest('/api/products', token),
			apiRequest('/api/products/categories', token),
		]);
		setProducts(productRows.map((product) => ({ ...product, price: Number(product.price) })));
		setCategories(categoryRows);
	}, [token]);

	useEffect(() => {
		loadInventory()
			.catch((loadError) => setError(loadError.message))
			.finally(() => setLoading(false));
	}, [loadInventory]);

	const lowStockProducts = products.filter((product) => product.stock < product.low_stock_threshold);
	const visibleProducts = useMemo(() => products.filter((product) => (
		(category === 'All' || product.category === category)
		&& `${product.name} ${product.category} ${product.barcode || ''}`.toLowerCase().includes(searchTerm.toLowerCase().trim())
	)), [products, category, searchTerm]);

	const openAdd = () => {
		setError('');
		setSelectedImageName('');
		setModal('add');
	};

	const openEdit = (product) => {
		setError('');
		setSelectedImageName('');
		setModal(product);
	};

	const saveProduct = async (event) => {
		event.preventDefault();
		setSaving(true);
		setError('');
		const body = new FormData(event.currentTarget);
		try {
			await apiRequest(
				modal === 'add' ? '/api/products' : `/api/products/${modal.id}`,
				token,
				{ method: modal === 'add' ? 'POST' : 'PUT', body }
			);
			await loadInventory();
			setModal(null);
		} catch (saveError) {
			setError(saveError.message);
		} finally {
			setSaving(false);
		}
	};

	const deleteProduct = async () => {
		setError('');
		try {
			await apiRequest(`/api/products/${modal.id}`, token, { method: 'DELETE' });
			await loadInventory();
			setModal(null);
		} catch (deleteError) {
			setError(deleteError.message);
			setModal(null);
		}
	};

	return (
		<main className="inventory-page">
			<header className="inventory-heading">
				<div>
					<h1>Inventory</h1>
					<p>{products.length} products <span>· {lowStockProducts.length} low stock</span></p>
				</div>
				{isAdmin && <button className="inventory-primary-button" type="button" onClick={openAdd}>+ Add Product</button>}
			</header>

			{error && <p className="inventory-error" role="alert">{error}</p>}
			{lowStockProducts.length > 0 && <div className="low-stock-alert"><strong>Low Stock Alert:</strong> {lowStockProducts.map((product) => product.name).join(', ')}</div>}

			<div className="inventory-tools">
				<input aria-label="Search inventory" placeholder="Search products..." value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} />
				<select aria-label="Filter inventory category" value={category} onChange={(event) => setCategory(event.target.value)}>
					<option>All</option>
					{categories.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
				</select>
			</div>

			<div className="inventory-table-wrap">
				<table className="inventory-table">
					<thead><tr><th>Image</th><th>Product</th><th>Category</th><th>Price</th><th>Stock</th>{isAdmin && <th>Actions</th>}</tr></thead>
					<tbody>
						{!loading && visibleProducts.map((product) => (
							<tr key={product.id}>
								<td><img className="inventory-product-image" src={productImageUrl(product.image_url)} onError={handleProductImageError} alt="" /></td>
								<td>{product.name}</td><td>{product.category}</td><td className="inventory-price">₱{product.price.toFixed(2)}</td>
								<td><span className={product.stock < product.low_stock_threshold ? 'stock-badge low' : 'stock-badge'}>{product.stock}</span></td>
								{isAdmin && <td className="inventory-actions"><button type="button" onClick={() => openEdit(product)}>Edit</button><button className="delete-button" type="button" onClick={() => setModal({ type: 'delete', ...product })}>Delete</button></td>}
							</tr>
						))}
						{loading && <tr><td colSpan="6">Loading inventory…</td></tr>}
						{!loading && visibleProducts.length === 0 && <tr><td colSpan="6">No products found.</td></tr>}
					</tbody>
				</table>
			</div>

			{modal === 'add' || (modal && modal.type !== 'delete') ? (
				<div className="inventory-modal-backdrop" role="presentation"><form className="inventory-modal" encType="multipart/form-data" onSubmit={saveProduct}>
					<div className="inventory-modal-title"><h2>{modal === 'add' ? 'Add Product' : 'Edit Product'}</h2><button type="button" aria-label="Close" onClick={() => setModal(null)}>×</button></div>
					<label>Product Name<input required name="name" maxLength="200" defaultValue={modal === 'add' ? '' : modal.name} /></label>
					<label>Category<select required name="category_id" defaultValue={modal === 'add' ? (categories[0]?.id || '') : modal.category_id}>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
					<label>Barcode<input name="barcode" maxLength="64" defaultValue={modal === 'add' ? '' : (modal.barcode || '')} /></label>
					<label>Price (₱)<input required name="price" type="number" min="0" step="0.01" defaultValue={modal === 'add' ? '' : modal.price} /></label>
					<label>Stock<input required name="stock" type="number" min="0" step="1" defaultValue={modal === 'add' ? '0' : modal.stock} /></label>
					<label>Low-stock threshold<input required name="low_stock_threshold" type="number" min="0" step="1" defaultValue={modal === 'add' ? '30' : modal.low_stock_threshold} /></label>
					<div className="inventory-image-field">
						<span className="inventory-image-label">Product Image</span>
						<label className="inventory-image-upload">
							<input
								name="image"
								type="file"
								accept="image/jpeg,image/png,image/webp"
								onChange={(event) => setSelectedImageName(event.target.files?.[0]?.name || '')}
							/>
							<span className="inventory-upload-icon" aria-hidden="true">
								<svg viewBox="0 0 24 24" fill="none">
									<path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14.5v3A2.5 2.5 0 007.5 20h9a2.5 2.5 0 002.5-2.5v-3" />
								</svg>
							</span>
							<span className="inventory-upload-copy">
								<strong>{selectedImageName || 'Choose a product photo'}</strong>
								<small>{selectedImageName ? 'Click to choose a different image' : 'JPG, PNG, or WebP · up to 5 MB'}</small>
							</span>
							<span className="inventory-upload-button">Browse files</span>
						</label>
					</div>
					{modal !== 'add' && modal.image_url && <img className="inventory-image-preview" src={productImageUrl(modal.image_url)} onError={handleProductImageError} alt={`Current ${modal.name}`} />}
					{error && <p className="inventory-error" role="alert">{error}</p>}
					<div className="inventory-modal-actions"><button className="inventory-primary-button" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save Product'}</button><button type="button" onClick={() => setModal(null)}>Cancel</button></div>
				</form></div>
			) : modal?.type === 'delete' ? (
				<div className="inventory-modal-backdrop" role="presentation"><div className="inventory-modal delete-modal">
					<div className="inventory-modal-title"><h2>Archive Product</h2><button type="button" aria-label="Close" onClick={() => setModal(null)}>×</button></div><p>Are you sure you want to remove <strong>{modal.name}</strong> from inventory?</p><p className="delete-warning">Past sales records will be preserved.</p><div className="inventory-modal-actions"><button className="delete-confirm-button" type="button" onClick={deleteProduct}>Archive</button><button type="button" onClick={() => setModal(null)}>Cancel</button></div></div></div>
			) : null}
		</main>
	);
}

export default Inventory;
