'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ReactFlowProvider } from 'reactflow'
import { DiagramEditor } from '@/components/DiagramEditor'
import { NodePalette } from '@/components/NodePalette'
import { PropertiesPanel } from '@/components/PropertiesPanel'
import { Toolbar } from '@/components/Toolbar'
import { type RFGraph, type ValidationIssue } from '@hbmp/shared-types'
import { api } from '@/lib/api'

interface DiagramPageProps {
  params: {
    projectId: string
    diagramId: string
  }
}

export default function DiagramPage({ params }: DiagramPageProps) {
  const router = useRouter()
  const [graph, setGraph] = useState<RFGraph | null>(null)
  const [diagramName, setDiagramName] = useState('Untitled')
  const [diagramKind, setDiagramKind] = useState('process')
  const [diagramStatus, setDiagramStatus] = useState<'draft' | 'published'>('draft')
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // Load diagram on mount
  useEffect(() => {
    loadDiagram()
  }, [params.projectId, params.diagramId])

  const loadDiagram = async () => {
    try {
      setIsLoading(true)
      const data = await api<{
        rf: RFGraph
        meta?: { name?: string; status?: 'draft' | 'published'; kind?: string }
      }>(`/api/diagrams/${params.diagramId}`)
      setGraph(data.rf || { nodes: [], edges: [] })
      setDiagramName(data.meta?.name || 'Untitled')
      setDiagramStatus(data.meta?.status || 'draft')
      setDiagramKind(data.meta?.kind || 'process')
      setValidationIssues([])
    } catch (error) {
      console.error('Error loading diagram:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const saveDiagram = async (updatedGraph: RFGraph) => {
    try {
      setIsSaving(true)
      await api('/api/diagrams/save', {
        method: 'POST',
        body: JSON.stringify({
          projectId: params.projectId,
          diagramId: params.diagramId,
          name: diagramName,
          kind: diagramKind,
          status: diagramStatus,
          rf: updatedGraph,
        }),
      })
      setGraph(updatedGraph)
    } catch (error) {
      console.error('Error saving diagram:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleGraphChange = (updatedGraph: RFGraph) => {
    setGraph(updatedGraph)
    // Auto-save after a debounce delay
    saveDiagram(updatedGraph)
  }

  const handleValidate = async () => {
    if (!graph) return

    try {
      const response = await fetch(`/api/projects/${params.projectId}/diagrams/${params.diagramId}/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ rfGraph: graph }),
      })

      if (!response.ok) throw new Error('Failed to validate diagram')
      
      const data = await response.json()
      setValidationIssues(data.validationIssues || [])
    } catch (error) {
      console.error('Error validating diagram:', error)
    }
  }

  const handleLayout = async (algorithm: string) => {
    if (!graph) return

    try {
      const response = await fetch(`/api/projects/${params.projectId}/diagrams/${params.diagramId}/layout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          rfGraph: graph,
          algorithm 
        }),
      })

      if (!response.ok) throw new Error('Failed to apply layout')
      
      const data = await response.json()
      setGraph(data.rfGraph)
    } catch (error) {
      console.error('Error applying layout:', error)
    }
  }

  const handleExport = async (format: 'svg' | 'png' | 'pdf' | 'mermaid') => {
    if (!graph) return

    try {
      const response = await fetch(`/api/projects/${params.projectId}/diagrams/${params.diagramId}/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          rfGraph: graph,
          format 
        }),
      })

      if (!response.ok) throw new Error('Failed to export diagram')
      
      if (format === 'mermaid') {
        const data = await response.json()
        // Handle mermaid text response
        console.log('Mermaid diagram:', data.content)
      } else {
        // Handle binary file download
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.style.display = 'none'
        a.href = url
        a.download = `diagram.${format}`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (error) {
      console.error('Error exporting diagram:', error)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Loading diagram...</div>
      </div>
    )
  }

  if (!graph) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg text-red-600">Failed to load diagram</div>
      </div>
    )
  }

  return (
    <ReactFlowProvider>
      <div className="flex h-screen bg-gray-50">
        {/* Left Sidebar - Node Palette */}
        <div className="w-64 bg-white border-r border-gray-200 flex-shrink-0">
          <NodePalette />
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Toolbar */}
          <div className="h-14 bg-white border-b border-gray-200 flex-shrink-0">
            <Toolbar
              onValidate={handleValidate}
              onLayout={handleLayout}
              onExport={handleExport}
              validationIssues={validationIssues}
              isSaving={isSaving}
            />
          </div>

          {/* Canvas */}
          <div className="flex-1">
            <DiagramEditor
              graph={graph}
              validationIssues={validationIssues}
              onChange={handleGraphChange}
            />
          </div>
        </div>

        {/* Right Sidebar - Properties Panel */}
        <div className="w-80 bg-white border-l border-gray-200 flex-shrink-0">
          <PropertiesPanel
            graph={graph}
            validationIssues={validationIssues}
            onChange={handleGraphChange}
          />
        </div>
      </div>
    </ReactFlowProvider>
  )
}