/** Scrollable table area so sticky headers work. */
export const tableScrollContainerSx = {
  maxHeight: 'calc(100vh - 220px)',
  overflow: 'auto',
} as const

/** Sticky header row (use on TableRow inside TableHead). */
export const stickyHeadRowSx = {
  '& th': {
    position: 'sticky',
    top: 0,
    zIndex: 2,
    backgroundColor: 'action.hover',
    boxShadow: (theme: { palette: { divider: string } }) => `0 1px 0 ${theme.palette.divider}`,
  },
} as const
