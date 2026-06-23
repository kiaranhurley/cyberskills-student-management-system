export function tableScrollSx(compact: boolean) {
  return {
    maxHeight: compact ? 'calc(100vh - 200px)' : 'calc(100vh - 240px)',
    overflow: 'auto' as const,
  }
}

export function stickyHeadCellSx() {
  return {
    position: 'sticky' as const,
    top: 0,
    zIndex: 2,
    bgcolor: 'background.paper',
    backgroundImage: 'none',
    boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.12)',
  }
}

export function compactCellPadding(compact: boolean) {
  return compact ? { py: 0.5, px: 1 } : {}
}
