export type PluginDescriptor = {
  name: string
  url: string
  version?: string
  description?: string
  mirrors?: string[]
}

export type PluginFeed = {
  desc?: string
  plugins: PluginDescriptor[]
  source?: 'remote' | 'fallback'
}

export type InstalledPlugin = PluginDescriptor & {
  id: string
  enabled: boolean
  installedAt: number
}

export type PluginCapability = 'search' | 'lyrics' | 'playlist' | 'stream'

export type PluginTrack = {
  id: string
  title: string
  artists: string[]
  album?: string
  coverUrl?: string
  duration?: number
  streamUrl?: string
  extra?: Record<string, unknown>
}

export type PluginArtist = {
  id: string
  name: string
  avatar?: string
  description?: string
  worksNum?: number
  extra?: Record<string, unknown>
}

export type PluginAlbum = {
  id: string
  title: string
  artist?: string
  coverUrl?: string
  date?: string
  description?: string
  extra?: Record<string, unknown>
}

export type PluginPlaylist = {
  id: string
  title: string
  artist?: string
  coverUrl?: string
  playCount?: number
  description?: string
  worksNum?: number
  extra?: Record<string, unknown>
}

export type PluginTopListGroup = {
  title: string
  data: PluginPlaylist[]
}

export type PluginRecommendTag = {
  id: string
  title: string
  raw?: unknown
  [key: string]: unknown
}

export type PluginStream = {
  url: string
  mimeType?: string
  headers?: Record<string, string>
  extra?: Record<string, unknown>
  lrc?: string
}

export type SearchType = 'music' | 'artist' | 'album' | 'sheet'

export type SearchResult<T> = {
  data: T[]
  isEnd: boolean
}

export type MusicPlugin = {
  name: string
  version?: string
  author?: string
  homepage?: string
  capabilities: PluginCapability[]
  supportedSearchTypes?: SearchType[]
  searchSongs(query: string, page?: number): Promise<SearchResult<PluginTrack> | PluginTrack[]>
  searchArtists?(query: string, page?: number): Promise<SearchResult<PluginArtist>>
  searchAlbums?(query: string, page?: number): Promise<SearchResult<PluginAlbum>>
  searchPlaylists?(query: string, page?: number): Promise<SearchResult<PluginPlaylist>>
  getArtistSongs?(artist: PluginArtist, page?: number): Promise<SearchResult<PluginTrack>>
  getAlbumSongs?(album: PluginAlbum): Promise<PluginTrack[]>
  getPlaylistSongs?(playlist: PluginPlaylist): Promise<PluginTrack[]>
  resolveStream?(track: PluginTrack): Promise<PluginStream>
  getTopLists?(): Promise<PluginTopListGroup[]>
  getTopListDetail?(playlist: PluginPlaylist): Promise<{ topListItem?: PluginPlaylist; musicList?: PluginTrack[] }>
  getRecommendSheetTags?(): Promise<PluginRecommendTag[]>
  getRecommendSheetsByTag?(tag: PluginRecommendTag | string, page?: number): Promise<SearchResult<PluginPlaylist>>
}

export type LoadedPlugin = {
  meta: InstalledPlugin
  instance?: MusicPlugin
  status: 'idle' | 'loading' | 'ready' | 'error'
  error?: string
}
