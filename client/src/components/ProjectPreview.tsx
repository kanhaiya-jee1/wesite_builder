
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState
} from 'react'
import type { Project } from '../types'
import { iframeScript } from '../assets/assets'
import EditorPanel from './EditorPanel'
import LoaderSteps from './LoaderSteps'

interface ProjectPreviewProps {
  project: Project
  isGenerating: boolean
  device?: 'phone' | 'tablet' | 'desktop'
  showEditorPanel?: boolean
}

export interface ProjectPreviewRef {
  getCode: () => string | undefined
}

const ProjectPreview = forwardRef<ProjectPreviewRef, ProjectPreviewProps>(
  ({ project, isGenerating, device = 'desktop', showEditorPanel = true }, ref) => {

    const iframeRef = useRef<HTMLIFrameElement>(null)
    const htmlCacheRef = useRef<string | undefined>(undefined) 
    const [selectedElement, setSelectedElement] = useState<any>(null)

    const resolutions = {
      phone: 'w-[412px]',
      tablet: 'w-[768px]',
      desktop: 'w-full'
    }

    useImperativeHandle(ref, () => ({
      getCode: () => {
       
        if (htmlCacheRef.current) return htmlCacheRef.current

        const iframe = iframeRef.current
        const doc = iframe?.contentDocument

        if (!doc) return project?.current_code

       
        doc
          .querySelectorAll('.ai-selected-element, [data-ai-selected]')
          .forEach((el) => {
            el.classList.remove('ai-selected-element')
            el.removeAttribute('data-ai-selected')
            ;(el as HTMLElement).style.outline = ''
          })

        const previewStyle = doc.getElementById('ai-preview-style')
        if (previewStyle) previewStyle.remove()

        const previewScript = doc.getElementById('ai-preview-script')
        if (previewScript) previewScript.remove()

        const html = doc.documentElement.outerHTML
        htmlCacheRef.current = html 
        return html
      }
    }))

    useEffect(() => {
      const handleMessage = (event: MessageEvent) => {
        if (event.data.type === 'ELEMENT_SELECTED') {
          setSelectedElement(event.data.payload)
        } else if (event.data.type === 'CLEAR_SELECTION') {
          setSelectedElement(null)
        }
      }
      window.addEventListener('message', handleMessage)
      return () => window.removeEventListener('message', handleMessage)
    }, [])

    const handleUpdate = (updates: any) => {
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          {
            type: 'UPDATE_ELEMENT',
            payload: updates
          },
          '*'
        )
      }
    }

    const imageFixerScript = `
        <script>
        (function() {
            function fixImages() {
                const images = document.getElementsByTagName('img');
                for (let img of images) {
                    if (!img.dataset.fixApplied) {
                        img.addEventListener('error', function() {
                            const keyword = img.alt || 'professional-photography';
                            console.log('Fixing broken image with keyword:', keyword);
                            // Primary source: LoremFlickr (highly reliable)
                            img.src = 'https://loremflickr.com/800/600/' + encodeURIComponent(keyword.replace(/\s+/g, '-')) + '?random=' + Math.random();
                        });
                        img.dataset.fixApplied = 'true';
                        // Handle already broken images
                        if (img.complete && img.naturalWidth === 0) {
                            img.dispatchEvent(new Event('error'));
                        }
                    }
                }
                
                // Also fix background images that might be broken
                const allElements = document.querySelectorAll('*');
                for (let el of allElements) {
                    const bg = window.getComputedStyle(el).backgroundImage;
                    if (bg && bg.includes('unsplash.com') && bg.includes('photo-1')) {
                        // If it looks like a guessed Unsplash ID, it's probably broken
                        // We'll let the browser try to load it, but we can't easily catch BG errors
                        // So we'll just encourage the AI to use LoremFlickr for BGs too
                    }
                }
            }
            // Run frequently to catch everything
            window.addEventListener('load', fixImages);
            fixImages();
            setInterval(fixImages, 1500);
        })();
        </script>
    `;

    const injectPreview = (html: string) => {
      if (!html) return ''
      if (!showEditorPanel) return html

      const scripts = iframeScript + imageFixerScript;

      // Ensure we have a body to inject into
      if (html.includes('</body>')) {
        return html.replace('</body>', scripts + '</body>')
      } else if (html.includes('</html>')) {
        return html.replace('</html>', scripts + '</html>')
      } else {
        return html + scripts
      }
    }

    return (
      <div className="relative h-full bg-gray-900 flex-1 rounded-xl overflow-hidden max-sm:ml-2">
        {project.current_code ? (
          <>
            <iframe
              ref={iframeRef}
              srcDoc={injectPreview(project.current_code)}
              className={`h-full max-sm:w-full ${resolutions[device]} mx-auto transition-all`}
              onLoad={() => {
               
                const doc = iframeRef.current?.contentDocument
                if (doc) {
                  htmlCacheRef.current = doc.documentElement.outerHTML
                }
              }}
            />

            {showEditorPanel && selectedElement && (
              <EditorPanel
                selectedElement={selectedElement}
                onUpdate={handleUpdate}
                onClose={() => {
                  setSelectedElement(null)
                  iframeRef.current?.contentWindow?.postMessage(
                    { type: 'CLEAR_SELECTION_REQUEST' },
                    '*'
                  )
                }}
              />
            )}
          </>
        ) : (
          isGenerating &&  <LoaderSteps />
        )}
      </div>
    )
  }
)

export default ProjectPreview

