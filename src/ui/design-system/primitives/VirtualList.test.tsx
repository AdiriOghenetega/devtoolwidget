import { fireEvent, render, screen } from '@testing-library/preact';
import { describe, expect, it } from 'vitest';
import { axeViolations } from '../testing/axe';
import { VirtualList } from './VirtualList';

const items = Array.from({ length: 500 }, (_, index) => index);

describe('VirtualList', () => {
  it('renders only a window of items', () => {
    render(
      <VirtualList
        items={items}
        itemHeight={20}
        height={100}
        renderItem={(item) => <span>{item}</span>}
      />,
    );
    const rendered = screen.getAllByRole('listitem');
    expect(rendered.length).toBeLessThan(20);
    expect(screen.getByText('0')).toBeTruthy();
  });

  it('loads a later window on scroll', () => {
    render(
      <VirtualList
        items={items}
        itemHeight={20}
        height={100}
        renderItem={(item) => <span>{item}</span>}
      />,
    );
    fireEvent.scroll(screen.getByRole('list'), { target: { scrollTop: 4_000 } });
    expect(screen.getByText('201')).toBeTruthy();
  });

  it('shows an empty state', () => {
    render(<VirtualList items={[]} itemHeight={20} height={100} renderItem={() => <span />} />);
    expect(screen.getByText('No items')).toBeTruthy();
  });

  it('has no axe violations', async () => {
    const { container } = render(
      <VirtualList
        items={items}
        itemHeight={20}
        height={100}
        renderItem={(item) => <span>{item}</span>}
      />,
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});
