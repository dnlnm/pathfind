import { useState, useEffect } from 'react'
import { Button } from './components/ui/button'
import { Input } from './components/ui/input'
import { Label } from './components/ui/label'
import { Textarea } from './components/ui/textarea'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './components/ui/card'
import { Checkbox } from './components/ui/checkbox'
import { Loader2, Settings, BookmarkPlus, ArrowLeft } from 'lucide-react'

type Config = {
  url: string;
  token: string;
}

export default function App() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [config, setConfig] = useState<Config | null>(null)
  const [showConfig, setShowConfig] = useState(false)

  // Bookmark state
  const [bookmarkUrl, setBookmarkUrl] = useState('')
  const [bookmarkTitle, setBookmarkTitle] = useState('')
  const [bookmarkNotes, setBookmarkNotes] = useState('')
  const [isReadLater, setIsReadLater] = useState(false)

  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  // Config form state
  const [configUrl, setConfigUrl] = useState('')
  const [configToken, setConfigToken] = useState('')

  useEffect(() => {
    // Load config from storage
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get(['pathfind_url', 'pathfind_token'], (result: { [key: string]: any }) => {
        if (result.pathfind_url && result.pathfind_token) {
          setConfig({ url: result.pathfind_url, token: result.pathfind_token })
        } else {
          setShowConfig(true)
        }
        setLoading(false)

        // Get current tab
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs: chrome.tabs.Tab[]) => {
          if (tabs[0] && tabs[0].url) {
            setBookmarkUrl(tabs[0].url)
            setBookmarkTitle(tabs[0].title || '')

            if (result.pathfind_url && result.pathfind_token) {
              try {
                const res = await fetch(`${result.pathfind_url}/api/bookmarks/check?url=${encodeURIComponent(tabs[0].url)}`, {
                  headers: { 'Authorization': `Bearer ${result.pathfind_token}` }
                });
                if (res.ok) {
                  const data = await res.json();
                  if (data.bookmarked) {
                    setSuccess(true);
                  }
                }
              } catch (e) {
                console.error(e);
              }
            }
          }
        })
      })
    } else {
      // Local dev fallback
      setLoading(false)
      setShowConfig(true)
    }

    // Set theme for testing testing, ideally matching system or main app
    document.documentElement.classList.add('dark')
  }, [])

  const handleSaveConfig = () => {
    const url = configUrl.replace(/\/$/, '') // remove trailing slash
    const configData = { url, token: configToken }
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set({
        pathfind_url: url,
        pathfind_token: configToken
      }, () => {
        setConfig(configData)
        setShowConfig(false)
      })
    } else {
      setConfig(configData)
      setShowConfig(false)
    }
  }

  const handleSaveBookmark = async () => {
    if (!config) return

    setSaving(true)
    setError('')
    setSuccess(false)

    try {
      const res = await fetch(`${config.url}/api/bookmarks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.token}`
        },
        body: JSON.stringify({
          url: bookmarkUrl,
          title: bookmarkTitle,
          notes: bookmarkNotes,
          isReadLater
        })
      })

      if (!res.ok) {
        throw new Error(`Failed to save: ${res.statusText}`)
      }

      setSuccess(true)

      // Notify background script to update badge
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0] && tabs[0].id) {
            chrome.runtime.sendMessage({
              action: 'bookmarkSaved',
              tabId: tabs[0].id
            })
          }
        })
      }

      setTimeout(() => {
        if (typeof chrome !== 'undefined' && chrome.notifications) {
          window.close() // Close popup on success after slight delay
        }
      }, 1500)
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="w-[400px] h-[300px] flex items-center justify-center bg-background text-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="w-[400px] min-h-[300px] font-sans antialiased text-foreground bg-background">
      {showConfig ? (
        <Card className="border-0 shadow-none rounded-none bg-background">
          <CardHeader className="px-6 pt-6 pb-4">
            <div className="flex items-center gap-2">
              {config && (
                <Button variant="ghost" size="icon" className="h-8 w-8 -ml-2" onClick={() => setShowConfig(false)}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              <div>
                <CardTitle className="text-xl">Settings</CardTitle>
                <CardDescription>Configure your Pathfind instance</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="url">Pathfind App URL</Label>
              <Input
                id="url"
                placeholder="https://pathfind.nxim.dev"
                value={configUrl}
                onChange={(e) => setConfigUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="token">API Token</Label>
              <Input
                id="token"
                type="password"
                placeholder="pf_..."
                value={configToken}
                onChange={(e) => setConfigToken(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Generate this in your Pathfind Settings &gt; Integrations.
              </p>
            </div>
          </CardContent>
          <CardFooter className="px-6 pb-6">
            <Button className="w-full" onClick={handleSaveConfig} disabled={!configUrl || !configToken}>
              Save Settings
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <Card className="border-0 shadow-none rounded-none bg-background">
          <CardHeader className="px-6 pt-6 flex flex-row items-center justify-between pb-4">
            <div className="flex items-center gap-2 text-primary font-bold">
              <BookmarkPlus className="h-5 w-5" />
              <span>Save to Pathfind</span>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
              setConfigUrl(config?.url || '')
              setConfigToken(config?.token || '')
              setShowConfig(true)
            }}>
              <Settings className="h-4 w-4" />
            </Button>
          </CardHeader>

          <CardContent className="px-6 space-y-4 pt-0">
            {success && (
              <div className="bg-emerald-500/15 text-emerald-500 text-sm p-3 rounded-md mb-2 font-medium text-center">
                Bookmark saved successfully!
              </div>
            )}

            {error && (
              <div className="bg-destructive/15 text-destructive text-sm p-3 rounded-md mb-2">
                {error}
              </div>
            )}

            <div className="space-y-1">
              <Label htmlFor="title" className="text-xs text-muted-foreground">Title</Label>
              <Input
                id="title"
                value={bookmarkTitle}
                onChange={(e) => setBookmarkTitle(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="url" className="text-xs text-muted-foreground">URL</Label>
              <Input
                id="url"
                value={bookmarkUrl}
                onChange={(e) => setBookmarkUrl(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="notes" className="text-xs text-muted-foreground">Notes (Optional)</Label>
              <Textarea
                id="notes"
                className="resize-none h-20"
                placeholder="Add your notes here..."
                value={bookmarkNotes}
                onChange={(e) => setBookmarkNotes(e.target.value)}
              />
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <Checkbox
                id="read-later"
                checked={isReadLater}
                onCheckedChange={(c: boolean | 'indeterminate') => setIsReadLater(c === true)}
              />
              <Label htmlFor="read-later" className="font-normal cursor-pointer">
                Read Later
              </Label>
            </div>
          </CardContent>

          <CardFooter className="px-6 pb-6 pt-2">
            <Button
              className="w-full"
              onClick={handleSaveBookmark}
              disabled={saving || !bookmarkUrl || success}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {saving ? 'Saving...' : success ? 'Saved' : 'Save Bookmark'}
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  )
}
