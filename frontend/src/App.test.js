import { render, screen } from '@testing-library/react';
import App from './App';

test('renders the Bili-Bili sign in screen', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: /bili-bili/i })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: /log in/i })).toBeInTheDocument();
  expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/password/i, { selector: 'input' })).toBeInTheDocument();
});
