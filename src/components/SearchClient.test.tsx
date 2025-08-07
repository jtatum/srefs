import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SearchClient from './SearchClient';
import { mockSearchItems } from '../../tests/mocks/mockData';

describe('SearchClient', () => {
  it('should render search input and all items initially', () => {
    render(<SearchClient items={mockSearchItems} />);

    const searchInput = screen.getByPlaceholderText(/search srefs/i);
    expect(searchInput).toBeInTheDocument();

    // All items should be visible initially
    expect(screen.getByText('Watercolor Dreams')).toBeInTheDocument();
    expect(screen.getByText('Cyberpunk Neon')).toBeInTheDocument();
    expect(screen.getByText('Abstract Geometry')).toBeInTheDocument();
  });

  describe('Search functionality', () => {
    it('should filter items by title', async () => {
      const user = userEvent.setup();
      render(<SearchClient items={mockSearchItems} />);

      const searchInput = screen.getByPlaceholderText(/search srefs/i);
      await user.type(searchInput, 'watercolor');

      await waitFor(() => {
        expect(screen.getByText('Watercolor Dreams')).toBeInTheDocument();
        expect(screen.queryByText('Cyberpunk Neon')).not.toBeInTheDocument();
        expect(screen.queryByText('Abstract Geometry')).not.toBeInTheDocument();
      });
    });

    it('should filter items by ID', async () => {
      const user = userEvent.setup();
      render(<SearchClient items={mockSearchItems} />);

      const searchInput = screen.getByPlaceholderText(/search srefs/i);
      await user.type(searchInput, '87654321');

      await waitFor(() => {
        expect(screen.getByText('Cyberpunk Neon')).toBeInTheDocument();
        expect(screen.queryByText('Watercolor Dreams')).not.toBeInTheDocument();
      });
    });

    it('should filter items by description', async () => {
      const user = userEvent.setup();
      render(<SearchClient items={mockSearchItems} />);

      const searchInput = screen.getByPlaceholderText(/search srefs/i);
      await user.type(searchInput, 'futuristic');

      await waitFor(() => {
        expect(screen.getByText('Cyberpunk Neon')).toBeInTheDocument();
        expect(screen.queryByText('Watercolor Dreams')).not.toBeInTheDocument();
      });
    });

    it('should show no results message when nothing matches', async () => {
      const user = userEvent.setup();
      render(<SearchClient items={mockSearchItems} />);

      const searchInput = screen.getByPlaceholderText(/search srefs/i);
      await user.type(searchInput, 'nonexistent');

      await waitFor(() => {
        expect(screen.getByText(/no matching srefs found/i)).toBeInTheDocument();
      });
    });

    it('should perform fuzzy search', async () => {
      const user = userEvent.setup();
      render(<SearchClient items={mockSearchItems} />);

      const searchInput = screen.getByPlaceholderText(/search srefs/i);
      await user.type(searchInput, 'cyberpnk'); // Typo intentional

      await waitFor(() => {
        expect(screen.getByText('Cyberpunk Neon')).toBeInTheDocument();
      });
    });
  });

  describe('Tag filtering', () => {
    it('should display all unique tags', () => {
      render(<SearchClient items={mockSearchItems} />);

      // Use getAllByText since tags appear in both filter buttons and cards
      expect(screen.getAllByText('watercolor').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('cyberpunk').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('abstract').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('neon').length).toBeGreaterThanOrEqual(1);
    });

    it('should filter by single tag', async () => {
      const user = userEvent.setup();
      render(<SearchClient items={mockSearchItems} />);

      // Get the filter button specifically (first occurrence)
      const watercolorTags = screen.getAllByText('watercolor');
      const watercolorTag = watercolorTags[0]; // The filter button
      await user.click(watercolorTag);

      await waitFor(() => {
        expect(screen.getByText('Watercolor Dreams')).toBeInTheDocument();
        expect(screen.queryByText('Cyberpunk Neon')).not.toBeInTheDocument();
        expect(screen.queryByText('Abstract Geometry')).not.toBeInTheDocument();
      });
    });

    it('should filter by multiple tags (AND logic)', async () => {
      const user = userEvent.setup();
      
      // Create an item with multiple tags for testing
      const itemsWithOverlappingTags = [
        ...mockSearchItems,
        {
          id: '99999999',
          title: 'Soft Cyberpunk',
          description: 'A mix of styles',
          tags: ['soft', 'cyberpunk'],
          searchText: 'soft cyberpunk mix styles soft cyberpunk',
          coverImageUrl: '/test.jpg',
          path: '/sref/99999999',
        },
      ];

      render(<SearchClient items={itemsWithOverlappingTags} />);

      const softTags = screen.getAllByText('soft');
      const softTag = softTags[0]; // Filter button
      const cyberpunkTags = screen.getAllByText('cyberpunk');
      const cyberpunkTag = cyberpunkTags[0]; // Filter button

      await user.click(softTag);
      await user.click(cyberpunkTag);

      await waitFor(() => {
        expect(screen.getByText('Soft Cyberpunk')).toBeInTheDocument();
        expect(screen.queryByText('Watercolor Dreams')).not.toBeInTheDocument();
        expect(screen.queryByText('Cyberpunk Neon')).not.toBeInTheDocument();
      });
    });

    it('should toggle tag selection', async () => {
      const user = userEvent.setup();
      render(<SearchClient items={mockSearchItems} />);

      const watercolorTags = screen.getAllByText('watercolor');
      const watercolorTag = watercolorTags[0]; // Filter button
      
      // Click to select
      await user.click(watercolorTag);
      expect(watercolorTag).toHaveClass('bg-blue-500');

      // Click to deselect
      await user.click(watercolorTag);
      expect(watercolorTag).not.toHaveClass('bg-blue-500');
      
      // All items should be visible again
      await waitFor(() => {
        expect(screen.getByText('Watercolor Dreams')).toBeInTheDocument();
        expect(screen.getByText('Cyberpunk Neon')).toBeInTheDocument();
        expect(screen.getByText('Abstract Geometry')).toBeInTheDocument();
      });
    });
  });

  describe('Combined search and tag filtering', () => {
    it('should combine text search with tag filters', async () => {
      const user = userEvent.setup();
      
      const itemsWithMixedContent = [
        ...mockSearchItems,
        {
          id: '22222222',
          title: 'Dark Dreams',
          description: 'Dark artistic style',
          tags: ['dark', 'artistic'],
          searchText: 'dark dreams dark artistic style dark artistic',
          coverImageUrl: '/test.jpg',
          path: '/sref/22222222',
        },
      ];

      render(<SearchClient items={itemsWithMixedContent} />);

      // Select 'dark' tag
      const darkTags = screen.getAllByText('dark');
      const darkTag = darkTags[0]; // Filter button
      await user.click(darkTag);

      // Search for 'dreams'
      const searchInput = screen.getByPlaceholderText(/search srefs/i);
      await user.type(searchInput, 'dreams');

      await waitFor(() => {
        expect(screen.getByText('Dark Dreams')).toBeInTheDocument();
        expect(screen.queryByText('Watercolor Dreams')).not.toBeInTheDocument(); // Has 'dreams' but not 'dark' tag
        expect(screen.queryByText('Cyberpunk Neon')).not.toBeInTheDocument(); // Has 'dark' tag but not 'dreams'
      });
    });
  });

  describe('Clear filters', () => {
    it('should show clear button when filters are active', async () => {
      const user = userEvent.setup();
      render(<SearchClient items={mockSearchItems} />);

      const searchInput = screen.getByPlaceholderText(/search srefs/i);
      await user.type(searchInput, 'test');

      await waitFor(() => {
        expect(screen.getByText(/clear filters/i)).toBeInTheDocument();
      });
    });

    it('should clear all filters when clear button is clicked', async () => {
      const user = userEvent.setup();
      render(<SearchClient items={mockSearchItems} />);

      // Set search query
      const searchInput = screen.getByPlaceholderText(/search srefs/i);
      await user.type(searchInput, 'watercolor');

      // Select a tag
      const softTags = screen.getAllByText('soft');
      const softTag = softTags[0]; // Filter button
      await user.click(softTag);

      // Click clear
      const clearButton = screen.getByText(/clear filters/i);
      await user.click(clearButton);

      await waitFor(() => {
        expect(searchInput).toHaveValue('');
        expect(softTag).not.toHaveClass('bg-blue-500');
        expect(screen.getByText('Watercolor Dreams')).toBeInTheDocument();
        expect(screen.getByText('Cyberpunk Neon')).toBeInTheDocument();
        expect(screen.getByText('Abstract Geometry')).toBeInTheDocument();
      });
    });
  });

  describe('UI rendering', () => {
    it('should render sref cards with all required information', () => {
      render(<SearchClient items={mockSearchItems} />);

      // Check first item
      expect(screen.getByText('Watercolor Dreams')).toBeInTheDocument();
      expect(screen.getByText('12345678')).toBeInTheDocument();
      expect(screen.getByText('Soft watercolor style')).toBeInTheDocument();
      
      // Check tags are rendered
      const watercolorTags = screen.getAllByText('watercolor');
      expect(watercolorTags.length).toBeGreaterThan(1); // One in filter, one in card
    });

    it('should render images with correct attributes', () => {
      render(<SearchClient items={mockSearchItems} />);

      const images = screen.getAllByRole('img');
      expect(images[0]).toHaveAttribute('src', mockSearchItems[0].coverImageUrl);
      expect(images[0]).toHaveAttribute('alt', mockSearchItems[0].title);
      expect(images[0]).toHaveAttribute('loading', 'lazy');
    });

    it('should render links to detail pages', () => {
      render(<SearchClient items={mockSearchItems} />);

      const links = screen.getAllByRole('link');
      expect(links[0]).toHaveAttribute('href', '/sref/12345678');
    });
  });
});