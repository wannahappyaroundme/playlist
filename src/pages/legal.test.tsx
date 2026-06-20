import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Terms from './Terms';
import Privacy from './Privacy';

describe('legal pages', () => {
  it('Terms renders its heading and effective date', () => {
    render(
      <MemoryRouter>
        <Terms />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: '이용약관', level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/시행일/)).toBeInTheDocument();
    expect(screen.getByText(/면책/)).toBeInTheDocument();
  });

  it('Privacy renders its heading and the "no server collection" statement', () => {
    render(
      <MemoryRouter>
        <Privacy />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: '개인정보처리방침', level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/수집·저장하지 않습니다/)).toBeInTheDocument();
  });
});
