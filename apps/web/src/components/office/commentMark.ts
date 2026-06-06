/* eslint-disable @typescript-eslint/no-explicit-any */
import { Mark, mergeAttributes } from '@tiptap/core';

/**
 * Inline comment mark. The whole comment thread (text, author, resolved) lives
 * in the mark's attributes, so comments travel inside the document's TipTap JSON
 * — no separate store and no change to the document content shape.
 */
export const CommentMark = Mark.create({
  name: 'comment',
  inclusive: false,
  excludes: '',

  addAttributes() {
    return {
      commentId: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-comment-id'),
        renderHTML: (attrs: any) => (attrs.commentId ? { 'data-comment-id': attrs.commentId } : {}),
      },
      text: { default: '', renderHTML: () => ({}) },
      author: { default: '', renderHTML: () => ({}) },
      createdAt: { default: null, renderHTML: () => ({}) },
      resolved: {
        default: false,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-resolved') === 'true',
        renderHTML: (attrs: any) => ({ 'data-resolved': attrs.resolved ? 'true' : 'false' }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-comment-id]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { class: 'tiptap-comment' }), 0];
  },

  addCommands() {
    return {
      setComment: (attrs: any) => ({ commands }: any) => commands.setMark(this.name, attrs),
      unsetComment: () => ({ commands }: any) => commands.unsetMark(this.name),
    } as any;
  },
});
