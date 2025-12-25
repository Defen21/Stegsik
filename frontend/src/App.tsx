import React, { useState } from 'react'
import axios from 'axios'
import { Upload, FileText, CheckCircle, AlertCircle, Download, ChevronUp, ChevronDown, Image } from 'lucide-react'

function App() {
    const [file, setFile] = useState<File | null>(null)
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState<any>(null)
    const [error, setError] = useState<string | null>(null)

    // Magic Patcher State
    const [patchFile, setPatchFile] = useState<File | null>(null)
    const [patchHeight, setPatchHeight] = useState<number | ''>('')
    const [patchLoading, setPatchLoading] = useState(false)
    const [patchResult, setPatchResult] = useState<string | null>(null)
    const [patchError, setPatchError] = useState<string | null>(null)

    // RGB Encryption State
    const [encryptFile, setEncryptFile] = useState<File | null>(null)
    const [encryptPassword, setEncryptPassword] = useState('')
    const [encryptLoading, setEncryptLoading] = useState(false)
    const [encryptResult, setEncryptResult] = useState<string | null>(null)
    const [encryptError, setEncryptError] = useState<string | null>(null)

    // Steganography Embedder State
    const [embedCover, setEmbedCover] = useState<File | null>(null)
    const [embedType, setEmbedType] = useState<'text' | 'file'>('text')
    const [embedText, setEmbedText] = useState('')
    const [embedFile, setEmbedFile] = useState<File | null>(null)

    const [useEmbedPassword, setUseEmbedPassword] = useState(false)
    const [embedPassword, setEmbedPassword] = useState('')
    const [extractFile, setExtractFile] = useState<File | null>(null)
    const [extractPassword, setExtractPassword] = useState('')
    const [embedLoading, setEmbedLoading] = useState(false)
    const [embedResult, setEmbedResult] = useState<string | null>(null)
    const [embedSuccessMsg, setEmbedSuccessMsg] = useState<string | null>(null)
    const [embedError, setEmbedError] = useState<string | null>(null)
    const [embedFilename, setEmbedFilename] = useState<string | null>(null)

    // Advanced Stego State
    const [advAction, setAdvAction] = useState<'hide' | 'recover'>('hide')
    const [advFile, setAdvFile] = useState<File | null>(null)
    const [advMessage, setAdvMessage] = useState('')
    const [advOffset, setAdvOffset] = useState<number | ''>(1024)
    const [advInterval, setAdvInterval] = useState<number | ''>(50)
    const [advLoading, setAdvLoading] = useState(false)
    const [advResult, setAdvResult] = useState<any>(null)
    const [advError, setAdvError] = useState<string | null>(null)

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

    // Warn on page refresh
    React.useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            e.preventDefault()
            e.returnValue = ''
        }
        window.addEventListener('beforeunload', handleBeforeUnload)
        return () => window.removeEventListener('beforeunload', handleBeforeUnload)
    }, [])

    // Auto-redirect unknown paths to root
    React.useEffect(() => {
        if (window.location.pathname !== '/') {
            window.location.replace('/');
        }
    }, [])



    const handleEmbed = async () => {
        if (!embedCover) return

        setEmbedLoading(true)
        setEmbedError(null)
        setEmbedResult(null)
        setEmbedFilename(null)

        const formData = new FormData()
        formData.append('cover', embedCover)

        if (embedType === 'text') {
            if (!embedText) {
                setEmbedError("Please enter text payload")
                setEmbedLoading(false)
                return
            }
            formData.append('payload_text', embedText)
        } else {
            if (!embedFile) {
                setEmbedError("Please select a payload file")
                setEmbedLoading(false)
                return
            }
            if (!embedFile.name.endsWith('.zip') && embedFile.type !== 'application/zip' && embedFile.type !== 'application/x-zip-compressed') {
                setEmbedError("Only .zip files are allowed for payload")
                setEmbedLoading(false)
                return
            }
            formData.append('payload_file', embedFile)
        }

        if (useEmbedPassword && embedPassword) {
            formData.append('password', embedPassword)
        }

        try {
            const response = await axios.post(`${API_URL}/embed`, formData)

            if (response.data.status === 'success') {
                setEmbedResult(response.data.download_url)
                setEmbedFilename(response.data.filename)
                setEmbedSuccessMsg(response.data.message)
            } else {
                setEmbedError(response.data.message || 'Embedding failed')
            }
        } catch (err: any) {
            console.error(err)
            setEmbedError(err.response?.data?.message || 'Error embedding data')
        } finally {
            setEmbedLoading(false)
        }
    }

    const handleExtract = async () => {
        if (!extractFile) return

        setEmbedLoading(true)
        setEmbedError(null)
        setEmbedResult(null)
        setEmbedFilename(null)

        const formData = new FormData()
        formData.append('file', extractFile)

        if (extractPassword) {
            formData.append('password', extractPassword)
        }

        try {
            const response = await axios.post(`${API_URL}/extract`, formData)

            if (response.data.status === 'success') {
                setEmbedResult(response.data.download_url)
                setEmbedFilename(response.data.filename)
                setEmbedSuccessMsg(response.data.message)
            } else {
                setEmbedError(response.data.message || 'Extraction failed')
            }
        } catch (err: any) {
            console.error(err)
            setEmbedError(err.response?.data?.message || 'Error extracting data')
        } finally {
            setEmbedLoading(false)
        }
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0])
            setError(null)
            setResult(null)
        }
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            setFile(e.dataTransfer.files[0])
            setError(null)
            setResult(null)
        }
    }

    const pollResult = async (taskId: string) => {
        try {
            const response = await axios.get(`${API_URL}/result/${taskId}`)
            if (response.data.status === 'completed') {
                setResult(response.data.result)
                setLoading(false)
            } else {
                setTimeout(() => pollResult(taskId), 2000)
            }
        } catch (err) {
            setError('Error fetching result')
            setLoading(false)
        }
    }

    const handleUpload = async () => {
        if (!file) return

        setLoading(true)
        setError(null)
        setResult(null)

        const formData = new FormData()
        formData.append('file', file)

        try {
            const response = await axios.post(`${API_URL}/upload`, formData)

            const { task_id } = response.data
            pollResult(task_id)

        } catch (err: any) {
            console.error(err)
            setError(err.response?.data?.message || 'Upload failed. Please try again.')
            setLoading(false)
        }
    }

    const handleDownload = async (url: string, filename: string) => {
        try {
            const response = await axios.get(url, { responseType: 'blob' });
            const blob = new Blob([response.data]);
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(blobUrl);
        } catch (error) {
            console.error("Download failed:", error);
        }
    };

    const handlePatch = async () => {
        if (!patchFile || !patchHeight) return

        setPatchLoading(true)
        setPatchError(null)
        setPatchResult(null)

        const formData = new FormData()
        formData.append('file', patchFile)
        formData.append('height', patchHeight.toString())

        try {
            const response = await axios.post(`${API_URL}/patch-height`, formData)

            if (response.data.status === 'success') {
                setPatchResult(response.data.download_url)
            } else {
                setPatchError(response.data.message || 'Patch failed')
            }
        } catch (err: any) {
            console.error(err)
            setPatchError(err.response?.data?.message || 'Error patching file')
        } finally {
            setPatchLoading(false)
        }
    }

    const handleEncryptionAction = async (mode: 'encrypt' | 'decrypt') => {
        if (!encryptFile || !encryptPassword) return

        setEncryptLoading(true)
        setEncryptError(null)
        setEncryptResult(null)

        const formData = new FormData()
        formData.append('file', encryptFile)
        formData.append('password', encryptPassword)

        try {
            const endpoint = mode === 'encrypt' ? '/encrypt' : '/decrypt'
            const response = await axios.post(`${API_URL}${endpoint}`, formData)

            if (response.data.status === 'success') {
                setEncryptResult(response.data.download_url)
            } else {
                setEncryptError(response.data.message || `${mode} failed`)
            }
        } catch (err: any) {
            console.error(err)
            setEncryptError(err.response?.data?.message || err.message || `Error during ${mode}`)
        } finally {
            setEncryptLoading(false)
        }
    }

    const handleAdvanced = async () => {
        if (!advFile) return

        setAdvLoading(true)
        setAdvError(null)
        setAdvResult(null)

        const formData = new FormData()
        formData.append('file', advFile)

        // Only append params if recovering. Hiding generates them.
        if (advAction === 'recover') {
            if (advOffset !== '') formData.append('offset', advOffset.toString())
            if (advInterval !== '') formData.append('interval', advInterval.toString())
        }

        try {
            let endpoint = ''
            if (advAction === 'hide') {
                if (!advMessage) {
                    setAdvError("Please enter a message to hide.")
                    setAdvLoading(false)
                    return
                }
                formData.append('message', advMessage)
                if (advOffset !== '') {
                    formData.append('start_offset', advOffset.toString())
                }
                if (advInterval !== '') {
                    formData.append('interval', advInterval.toString())
                }
                endpoint = '/steg/advanced/hide'
            } else {
                endpoint = '/steg/advanced/recover'
            }

            const response = await axios.post(`${API_URL}${endpoint}`, formData)

            if (response.data.status === 'success') {
                if (advAction === 'hide') {
                    setAdvResult({
                        type: 'download',
                        url: response.data.download_url,
                        filename: response.data.filename,
                        key_offset: response.data.key_offset,
                        key_interval: response.data.key_interval
                    })
                    // Auto-fill keys for convenience if user wants to recover immediately
                    setAdvOffset(response.data.key_offset)
                    setAdvInterval(response.data.key_interval)
                } else {
                    setAdvResult({ type: 'text', text: response.data.recovered_text })
                }
            } else {
                setAdvError(response.data.message || 'Operation failed')
            }
        } catch (err: any) {
            console.error(err)
            setAdvError(err.response?.data?.message || 'Error processing request')
        } finally {
            setAdvLoading(false)
        }
    }

    return (
        <div className="container">
            <div className="header main-page-header">
                <h1 className="title">Stegsik</h1>
                <p style={{ color: '#94a3b8', marginTop: '0.5rem' }}>Forensic Image Analysis Tool</p>
            </div>

            <div className="upload-card">
                <div className="header" style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                    <div>
                        <h2 className="title" style={{ fontSize: '1.5rem', color: '#818cf8' }}>Deep Forensic Analysis</h2>
                        <p style={{ color: '#94a3b8', marginTop: '0.5rem' }}>Analyze bit planes, metadata, and extract hidden artifacts.</p>
                    </div>
                </div>
                <div
                    className="drop-zone"
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onClick={() => document.getElementById('fileInput')?.click()}
                >
                    {file ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <FileText size={48} color="#818cf8" />
                            <p style={{ marginTop: '1rem', fontWeight: 500 }}>{file.name}</p>
                            <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Click or drop to replace</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <Upload size={48} color="#94a3b8" />
                            <p style={{ marginTop: '1rem', color: '#cbd5e1' }}>Drag & drop an image here, or click to select</p>
                        </div>
                    )}
                    <input
                        id="fileInput"
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        style={{ display: 'none' }}
                    />
                </div>

                <button
                    onClick={handleUpload}
                    disabled={!file || loading}
                    style={{ opacity: !file || loading ? 0.7 : 1, width: '100%' }}
                >
                    {loading ? (
                        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                            <span className="spinner"></span> Analyzing...
                        </span>
                    ) : 'Analyze Image'}
                </button>

                {error && (
                    <div style={{ marginTop: '1rem', color: '#f87171', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        <AlertCircle size={20} />
                        {error}
                    </div>
                )}
            </div>

            {result && (
                <div style={{ width: '100%', maxWidth: '1000px', margin: '2rem auto 0' }}>
                    <h2 style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', color: '#4ade80' }}>
                        <CheckCircle /> Analysis Complete
                    </h2>

                    {/* Bit Planes Section */}
                    <div className="result-section">
                        <div className="flex-stack-mobile" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h3 style={{ margin: 0 }}>Bit Planes</h3>
                            {result.images_zip && (
                                <button
                                    className="w-full-mobile"
                                    onClick={() => handleDownload(`${API_URL}/download/${result.images_zip}`, 'bitplanes.zip')}
                                    style={{
                                        padding: '0.5rem 1rem',
                                        background: '#4f46e5',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '6px',
                                        fontSize: '0.9rem',
                                        fontWeight: 500,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '6px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <Upload style={{ transform: 'rotate(180deg)' }} size={16} /> Download ZIP
                                </button>
                            )}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1rem' }}>
                            {result.bit_planes && Object.entries(result.bit_planes).map(([label, filename]: [string, any]) => (
                                <div key={label} style={{ background: '#0f172a', padding: '0.5rem', borderRadius: '8px', textAlign: 'center' }}>
                                    <p style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>{label}</p>
                                    <a
                                        href={`${API_URL}/uploads/${result.result_dir}/${filename}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{ display: 'block' }}
                                    >
                                        <img
                                            src={`${API_URL}/uploads/${result.result_dir}/${filename}`}
                                            alt={label}
                                            style={{ width: '100%', borderRadius: '4px', marginTop: '0.5rem', cursor: 'pointer' }}
                                            title="Click to open in new tab"
                                        />
                                    </a>
                                    <button
                                        onClick={() => handleDownload(`${API_URL}/uploads/${result.result_dir}/${filename}`, filename)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '6px',
                                            marginTop: '0.8rem',
                                            width: '100%',
                                            padding: '0.4rem',
                                            fontSize: '0.8rem',
                                            fontWeight: 500,
                                            color: '#e2e8f0',
                                            backgroundColor: '#334155',
                                            border: '1px solid #475569',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#475569'}
                                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#334155'}
                                    >
                                        <Download size={14} /> Download
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Tool Outputs Section */}
                    <div className="result-section" style={{ marginTop: '1rem' }}>
                        <h3>Forensic Tool Reports</h3>
                        {result.tool_outputs && Object.entries(result.tool_outputs).map(([toolName, output]: [string, any]) => (
                            <div key={toolName} style={{ marginBottom: '1.5rem', borderBottom: '1px solid #334155', paddingBottom: '1rem' }}>
                                <div className="flex-stack-mobile" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                    <h4 style={{ margin: 0, textTransform: 'capitalize' }}>{toolName}</h4>
                                    {output.file_path && !output.file_path.endsWith('.log') && (
                                        <button
                                            onClick={() => handleDownload(`${API_URL}/download/${output.file_path}`, output.file_path.split('/').pop() || 'output')}
                                            className="download-btn w-full-mobile"
                                            style={{
                                                padding: '0.4rem 0.8rem',
                                                background: '#334155',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '4px',
                                                fontSize: '0.9rem',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}
                                        >
                                            <Download size={14} style={{ marginRight: '6px' }} /> Download
                                        </button>
                                    )}
                                </div>
                                <div className="json-view" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                                        {output.content || JSON.stringify(output, null, 2)}
                                    </pre>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}


            {/* Magic Patcher Section */}
            <div className="upload-card" style={{ marginTop: '3rem', borderTop: '1px solid #334155', paddingTop: '2rem' }}>
                <div className="header">
                    <h2 className="title" style={{ fontSize: '1.5rem' }}>Magic Height Patcher</h2>
                    <p style={{ color: '#94a3b8', marginTop: '0.5rem' }}>Modify image height bytes (PNG/JPG) to reveal hidden footers.</p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1.5rem' }}>
                    {/* Styled File Input */}
                    <div
                        onClick={() => document.getElementById('patchFileInput')?.click()}
                        style={{
                            border: '2px dashed #475569',
                            borderRadius: '12px',
                            padding: '2rem',
                            textAlign: 'center',
                            cursor: 'pointer',
                            background: '#1e293b',
                            transition: 'all 0.2s',
                        }}
                        onMouseOver={(e) => e.currentTarget.style.borderColor = '#8b5cf6'}
                        onMouseOut={(e) => e.currentTarget.style.borderColor = '#475569'}
                    >
                        <input
                            id="patchFileInput"
                            type="file"
                            accept=".png,.jpg,.jpeg"
                            onChange={(e) => {
                                if (e.target.files?.[0]) {
                                    setPatchFile(e.target.files[0])
                                    setPatchResult(null)
                                    setPatchError(null)
                                }
                            }}
                            style={{ display: 'none' }}
                        />
                        {patchFile ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                                <div style={{ background: 'rgba(139, 92, 246, 0.2)', padding: '1rem', borderRadius: '50%' }}>
                                    <Image size={32} color="#a78bfa" />
                                </div>
                                <div>
                                    <p style={{ fontWeight: 600, color: '#e2e8f0' }}>{patchFile.name}</p>
                                    <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.2rem' }}>Click to change</p>
                                </div>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                                <div style={{ background: '#334155', padding: '1rem', borderRadius: '50%' }}>
                                    <Upload size={32} color="#94a3b8" />
                                </div>
                                <div>
                                    <p style={{ fontWeight: 500, color: '#cbd5e1' }}>Click to browse patch image</p>
                                    <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.2rem' }}>PNG or JPG</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Height Control */}
                    <div className="flex-stack-mobile" style={{ display: 'flex', gap: '1rem', alignItems: 'stretch', flexWrap: 'wrap' }}>
                        <div className="w-full-mobile" style={{ position: 'relative', flex: 1, minWidth: '200px', display: 'flex', alignItems: 'center' }}>
                            <input
                                type="number"
                                placeholder="New Height (px)"
                                value={patchHeight}
                                onChange={(e) => setPatchHeight(parseInt(e.target.value) || '')}
                                style={{
                                    width: '100%',
                                    padding: '0.8rem 2rem 0.8rem 1rem', // Added padding-right for spinners
                                    borderRadius: '8px',
                                    border: '1px solid #475569',
                                    background: '#1e293b',
                                    color: 'white',
                                    fontSize: '1rem',
                                    appearance: 'textfield'
                                }}
                            />
                            {/* Custom Spinner Controls */}
                            <div style={{
                                position: 'absolute',
                                right: '5px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '2px'
                            }}>
                                <button
                                    onClick={() => setPatchHeight((h) => (typeof h === 'number' ? h + 1 : 1))}
                                    style={{
                                        background: '#334155',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        padding: '1px',
                                        color: '#cbd5e1'
                                    }}
                                >
                                    <ChevronUp size={14} />
                                </button>
                                <button
                                    onClick={() => setPatchHeight((h) => (typeof h === 'number' ? Math.max(1, h - 1) : 1))}
                                    style={{
                                        background: '#334155',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        padding: '1px',
                                        color: '#cbd5e1'
                                    }}
                                >
                                    <ChevronDown size={14} />
                                </button>
                            </div>
                        </div>

                        <button
                            className="w-full-mobile"
                            onClick={handlePatch}
                            disabled={!patchFile || !patchHeight || patchLoading}
                            style={{
                                padding: '1rem',
                                background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
                                borderRadius: '8px',
                                fontWeight: 600,
                                opacity: !patchFile || !patchHeight || patchLoading ? 0.7 : 1,
                                cursor: !patchFile || !patchHeight || patchLoading ? 'not-allowed' : 'pointer'
                            }}
                        >
                            {patchLoading ? 'Patching...' : 'Patch Height'}
                        </button>
                    </div>

                    {patchError && (
                        <div style={{ background: '#450a0a', border: '1px solid #f87171', padding: '1rem', borderRadius: '8px', color: '#fca5a5', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <AlertCircle size={24} style={{ minWidth: '24px' }} />
                            <span style={{ fontWeight: 500 }}>{patchError}</span>
                        </div>
                    )}

                    {patchResult && (
                        <div style={{ marginTop: '1rem', background: '#0f172a', padding: '1rem', borderRadius: '8px' }}>
                            <h3 style={{ color: '#4ade80', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
                                <CheckCircle size={20} /> Success!
                            </h3>

                            {/* Image Preview */}
                            <div style={{
                                marginBottom: '1rem',
                                border: '1px solid #334155',
                                borderRadius: '4px',
                                overflow: 'hidden',
                                background: '#1e293b'
                            }}>
                                <img
                                    src={`${API_URL}/${patchResult}`}
                                    alt="Patched Result"
                                    style={{
                                        width: '100%',
                                        maxHeight: '400px',
                                        objectFit: 'contain',
                                        display: 'block'
                                    }}
                                />
                            </div>

                            <button
                                onClick={() => handleDownload(`${API_URL}/${patchResult}`, `patched_${patchFile?.name}`)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    background: '#10b981',
                                    padding: '0.5rem 1rem',
                                    borderRadius: '6px',
                                    border: 'none',
                                    color: 'white',
                                    cursor: 'pointer',
                                    width: '100%',
                                    justifyContent: 'center'
                                }}
                            >
                                <Download size={16} /> Download Patched Image
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* RGB Encryption Section */}
            <div className="upload-card" style={{ marginTop: '3rem', borderTop: '1px solid #334155', paddingTop: '2rem' }}>
                <div className="header">
                    <h2 className="title" style={{ fontSize: '1.5rem', color: '#f472b6' }}>RGB Scrambler</h2>
                    <p style={{ color: '#94a3b8', marginTop: '0.5rem' }}>Encrypt/Decrypt images by shuffling RGB values with a password.</p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1.5rem' }}>
                    {/* File Input */}
                    <div
                        onClick={() => document.getElementById('encryptFileInput')?.click()}
                        style={{
                            border: '2px dashed #475569',
                            borderRadius: '12px',
                            padding: '2rem',
                            textAlign: 'center',
                            cursor: 'pointer',
                            background: '#1e293b',
                            transition: 'all 0.2s',
                        }}
                        onMouseOver={(e) => e.currentTarget.style.borderColor = '#f472b6'}
                        onMouseOut={(e) => e.currentTarget.style.borderColor = '#475569'}
                    >
                        <input
                            id="encryptFileInput"
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                                if (e.target.files?.[0]) {
                                    setEncryptFile(e.target.files[0])
                                    setEncryptResult(null)
                                    setEncryptError(null)
                                }
                            }}
                            style={{ display: 'none' }}
                        />
                        {encryptFile ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                                <div style={{ background: 'rgba(244, 114, 182, 0.2)', padding: '1rem', borderRadius: '50%' }}>
                                    <Image size={32} color="#f472b6" />
                                </div>
                                <div>
                                    <p style={{ fontWeight: 600, color: '#e2e8f0' }}>{encryptFile.name}</p>
                                    <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.2rem' }}>Click to change</p>
                                </div>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                                <div style={{ background: '#334155', padding: '1rem', borderRadius: '50%' }}>
                                    <Upload size={32} color="#94a3b8" />
                                </div>
                                <div>
                                    <p style={{ fontWeight: 500, color: '#cbd5e1' }}>Click to browse image for Encryption/Decryption</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Password Input & Buttons */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <input
                            type="text"
                            placeholder="Enter Encryption Password"
                            value={encryptPassword}
                            onChange={(e) => setEncryptPassword(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '0.8rem 1rem',
                                borderRadius: '8px',
                                border: '1px solid #475569',
                                background: '#1e293b',
                                color: 'white',
                                fontSize: '1rem'
                            }}
                        />

                        <div className="flex-stack-mobile" style={{ display: 'flex', gap: '1rem' }}>
                            <button
                                onClick={() => handleEncryptionAction('encrypt')}
                                disabled={!encryptFile || !encryptPassword || encryptLoading}
                                style={{
                                    flex: 1,
                                    padding: '0.8rem',
                                    background: '#db2777',
                                    borderRadius: '8px',
                                    fontWeight: 600,
                                    opacity: !encryptFile || !encryptPassword || encryptLoading ? 0.7 : 1,
                                    cursor: !encryptFile || !encryptPassword || encryptLoading ? 'not-allowed' : 'pointer'
                                }}
                            >
                                {encryptLoading ? 'Processing...' : 'Encrypt Image'}
                            </button>
                            <button
                                onClick={() => handleEncryptionAction('decrypt')}
                                disabled={!encryptFile || !encryptPassword || encryptLoading}
                                style={{
                                    flex: 1,
                                    padding: '0.8rem',
                                    background: '#4f46e5',
                                    borderRadius: '8px',
                                    fontWeight: 600,
                                    opacity: !encryptFile || !encryptPassword || encryptLoading ? 0.7 : 1,
                                    cursor: !encryptFile || !encryptPassword || encryptLoading ? 'not-allowed' : 'pointer'
                                }}
                            >
                                {encryptLoading ? 'Processing...' : 'Decrypt Image'}
                            </button>
                        </div>
                    </div>

                    {encryptError && (
                        <div style={{ background: '#450a0a', border: '1px solid #f87171', padding: '1rem', borderRadius: '8px', color: '#fca5a5', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <AlertCircle size={24} style={{ minWidth: '24px' }} />
                            <span style={{ fontWeight: 500 }}>{encryptError}</span>
                        </div>
                    )}

                    {encryptResult && (
                        <div style={{ marginTop: '1rem', background: '#0f172a', padding: '1rem', borderRadius: '8px' }}>
                            <h3 style={{ color: '#4ade80', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
                                <CheckCircle size={20} /> Success!
                            </h3>

                            <div style={{
                                marginBottom: '1rem',
                                border: '1px solid #334155',
                                borderRadius: '4px',
                                overflow: 'hidden',
                                background: '#1e293b'
                            }}>
                                <img
                                    src={`${API_URL}/${encryptResult}`}
                                    alt="Encryption Result"
                                    style={{
                                        width: '100%',
                                        maxHeight: '400px',
                                        objectFit: 'contain',
                                        display: 'block'
                                    }}
                                />
                            </div>

                            <button
                                onClick={() => handleDownload(`${API_URL}/${encryptResult}`, `processed_${encryptFile?.name}.png`)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    background: '#10b981',
                                    padding: '0.5rem 1rem',
                                    borderRadius: '6px',
                                    border: 'none',
                                    color: 'white',
                                    cursor: 'pointer',
                                    width: '100%',
                                    justifyContent: 'center'
                                }}
                            >
                                <Download size={16} /> Download Result
                            </button>
                        </div>
                    )}
                </div>
            </div>
            {/* Steganography Embedder Section */}
            <div className="upload-card" style={{ marginTop: '3rem', borderTop: '1px solid #334155', paddingTop: '2rem' }}>
                <div className="header">
                    <h2 className="title" style={{ fontSize: '1.5rem', color: '#fbbf24' }}>Steganography Embedder</h2>
                    <p style={{ color: '#94a3b8', marginTop: '0.5rem' }}>Hide files/text inside an image, or extract hidden data.</p>
                </div>



                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1.5rem' }}>

                    {/* EMBED MODE - Always visible now */}
                    <>
                        {/* Cover Image */}
                        <div
                            onClick={() => document.getElementById('embedCoverInput')?.click()}
                            style={{
                                border: '2px dashed #475569',
                                borderRadius: '12px',
                                padding: '1.5rem',
                                textAlign: 'center',
                                cursor: 'pointer',
                                background: '#1e293b',
                                transition: 'all 0.2s',
                            }}
                        >
                            <input
                                id="embedCoverInput"
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                    if (e.target.files?.[0]) {
                                        setEmbedCover(e.target.files[0])
                                        setEmbedResult(null)
                                    }
                                }}
                                style={{ display: 'none' }}
                            />
                            {embedCover ? (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
                                    <Image size={24} color="#fbbf24" />
                                    <span style={{ fontWeight: 600, color: '#e2e8f0' }}>{embedCover.name}</span>
                                </div>
                            ) : (
                                <div style={{ color: '#cbd5e1' }}>
                                    <p style={{ fontWeight: 500 }}>Select Cover Image</p>
                                </div>
                            )}
                        </div>

                        {/* Payload Type Selection */}
                        <div className="flex-stack-mobile" style={{ display: 'flex', gap: '1rem' }}>
                            <button
                                onClick={() => setEmbedType('text')}
                                style={{
                                    flex: 1,
                                    background: embedType === 'text' ? '#fbbf24' : '#334155',
                                    color: embedType === 'text' ? '#1e293b' : '#cbd5e1',
                                    border: 'none',
                                    borderRadius: '6px',
                                    padding: '0.5rem'
                                }}
                            >
                                Text Payload
                            </button>
                            <button
                                onClick={() => setEmbedType('file')}
                                style={{
                                    flex: 1,
                                    background: embedType === 'file' ? '#fbbf24' : '#334155',
                                    color: embedType === 'file' ? '#1e293b' : '#cbd5e1',
                                    border: 'none',
                                    borderRadius: '6px',
                                    padding: '0.5rem'
                                }}
                            >
                                File Payload
                            </button>
                        </div>

                        {/* Payload Input */}
                        {embedType === 'text' ? (
                            <textarea
                                placeholder="Enter secret text to hide..."
                                value={embedText}
                                onChange={(e) => setEmbedText(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '0.8rem',
                                    borderRadius: '8px',
                                    border: '1px solid #475569',
                                    background: '#1e293b',
                                    color: 'white',
                                    minHeight: '100px',
                                    fontFamily: 'monospace'
                                }}
                            />
                        ) : (
                            <div
                                onClick={() => document.getElementById('embedPayloadInput')?.click()}
                                style={{
                                    border: '1px solid #475569',
                                    borderRadius: '8px',
                                    padding: '1rem',
                                    textAlign: 'center',
                                    cursor: 'pointer',
                                    background: '#1e293b'
                                }}
                            >
                                <input
                                    id="embedPayloadInput"
                                    type="file"
                                    accept=".zip,application/zip,application/x-zip-compressed"
                                    onChange={(e) => {
                                        if (e.target.files?.[0]) setEmbedFile(e.target.files[0])
                                    }}
                                    style={{ display: 'none' }}
                                />
                                {embedFile ? (
                                    <p style={{ color: '#fbbf24' }}>Selected: {embedFile.name}</p>
                                ) : (
                                    <p style={{ color: '#94a3b8' }}>Click to select secret file (Zip only)</p>
                                )}
                            </div>
                        )}

                        {/* Password Option */}
                        {/* Password Option Removed */}

                        <button
                            onClick={handleEmbed}
                            disabled={!embedCover || (embedType === 'text' ? !embedText : !embedFile) || embedLoading}
                            style={{
                                width: '100%',
                                padding: '1rem',
                                background: '#d97706',
                                color: 'white',
                                fontWeight: 'bold',
                                opacity: !embedCover || embedLoading ? 0.7 : 1,
                                cursor: 'pointer',
                                borderRadius: '8px',
                                border: 'none'
                            }}
                        >
                            {embedLoading ? 'Embedding...' : 'Embed Data'}
                        </button>
                    </>




                    {embedError && (
                        <div style={{ background: '#450a0a', border: '1px solid #f87171', padding: '1rem', borderRadius: '8px', color: '#fca5a5', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <AlertCircle size={24} style={{ minWidth: '24px' }} />
                            <span style={{ fontWeight: 500 }}>{embedError}</span>
                        </div>
                    )}

                    {embedResult && (
                        <div style={{ marginTop: '1rem', background: '#0f172a', padding: '1rem', borderRadius: '8px' }}>
                            <h3 style={{ color: '#4ade80', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.5rem' }}>
                                <CheckCircle size={20} /> Success!
                            </h3>
                            <p style={{ color: '#cbd5e1', fontSize: '0.9rem', marginBottom: '1rem' }}>{embedSuccessMsg}</p>

                            <button
                                onClick={() => handleDownload(`${API_URL}/${embedResult}`, embedFilename || `steg_result.bin`)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    background: '#10b981',
                                    padding: '0.5rem 1rem',
                                    borderRadius: '6px',
                                    border: 'none',
                                    color: 'white',
                                    cursor: 'pointer',
                                    width: '100%',
                                    justifyContent: 'center'
                                }}
                            >
                                <Download size={16} /> Download Result
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Advanced Steganography Section */}
            <div className="upload-card" style={{ marginTop: '3rem', borderTop: '1px solid #334155', paddingTop: '2rem' }}>
                <div className="header">
                    <h2 className="title" style={{ fontSize: '1.5rem', background: 'linear-gradient(to right, #38bdf8, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Advanced Morse Steganography</h2>
                    <p style={{ color: '#94a3b8', marginTop: '0.5rem' }}>Hide/Recover messages with randomized binary injection. Supports JPG & PNG.</p>
                </div>


                <div className="flex-stack-mobile" style={{
                    display: 'flex',
                    background: '#0f172a',
                    padding: '0.4rem',
                    borderRadius: '12px',
                    marginTop: '1.5rem',
                    border: '1px solid #334155'
                }}>
                    <button
                        onClick={() => { setAdvAction('hide'); setAdvResult(null); setAdvError(null); }}
                        style={{
                            flex: 1,
                            padding: '0.8rem',
                            background: advAction === 'hide' ? '#38bdf8' : 'transparent',
                            color: advAction === 'hide' ? '#0f172a' : '#94a3b8',
                            border: 'none',
                            borderRadius: '8px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            transition: 'all 0.3s ease',
                            boxShadow: advAction === 'hide' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none'
                        }}
                    >
                        Hide Message
                    </button>
                    <button
                        onClick={() => { setAdvAction('recover'); setAdvResult(null); setAdvError(null); }}
                        style={{
                            flex: 1,
                            padding: '0.8rem',
                            background: advAction === 'recover' ? '#38bdf8' : 'transparent',
                            color: advAction === 'recover' ? '#0f172a' : '#94a3b8',
                            border: 'none',
                            borderRadius: '8px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            transition: 'all 0.3s ease',
                            boxShadow: advAction === 'recover' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none'
                        }}
                    >
                        Recover Message
                    </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1.5rem' }}>
                    {/* File Input */}

                    <div
                        onClick={() => document.getElementById('advFileInput')?.click()}
                        style={{
                            border: '2px dashed #475569',
                            borderRadius: '12px',
                            padding: '3rem 2rem',
                            textAlign: 'center',
                            cursor: 'pointer',
                            background: advFile ? 'rgba(56, 189, 248, 0.05)' : '#1e293b',
                            transition: 'all 0.2s',
                            position: 'relative',
                            overflow: 'hidden'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.borderColor = '#38bdf8'}
                        onMouseOut={(e) => e.currentTarget.style.borderColor = '#475569'}
                    >
                        <input
                            id="advFileInput"
                            type="file"
                            accept=".jpg,.jpeg,.png"
                            onChange={(e) => {
                                if (e.target.files?.[0]) {
                                    setAdvFile(e.target.files[0])
                                    setAdvResult(null)
                                    setAdvError(null)
                                }
                            }}
                            style={{ display: 'none' }}
                        />
                        {advFile ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', position: 'relative', zIndex: 1 }}>
                                <div style={{ background: 'rgba(56, 189, 248, 0.15)', padding: '1.2rem', borderRadius: '50%', boxShadow: '0 0 15px rgba(56, 189, 248, 0.1)' }}>
                                    <Image size={40} color="#38bdf8" />
                                </div>
                                <div>
                                    <p style={{ fontWeight: 600, color: '#e2e8f0', fontSize: '1.1rem' }}>{advFile.name}</p>
                                    <button style={{
                                        marginTop: '0.8rem',
                                        background: '#334155',
                                        fontSize: '0.8rem',
                                        padding: '0.4rem 0.8rem',
                                        borderRadius: '20px',
                                        border: 'none',
                                        color: '#cbd5e1',
                                        cursor: 'pointer'
                                    }}>Change Image</button>
                                </div>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', position: 'relative', zIndex: 1 }}>
                                <div style={{ background: '#334155', padding: '1.2rem', borderRadius: '50%' }}>
                                    <Upload size={32} color="#94a3b8" />
                                </div>
                                <div>
                                    <p style={{ fontWeight: 500, color: '#cbd5e1', fontSize: '1.1rem' }}>Select Main Image</p>
                                    <p style={{ fontSize: '0.9rem', color: '#64748b', marginTop: '0.4rem' }}>JPG or PNG format supported</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {advAction === 'hide' && (
                        <div style={{ position: 'relative' }}>
                            <textarea
                                placeholder="Enter secret message to hide..."
                                value={advMessage}
                                onChange={(e) => setAdvMessage(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '1rem',
                                    borderRadius: '12px',
                                    border: '1px solid #475569',
                                    background: '#0f172a',
                                    color: 'white',
                                    minHeight: '200px',
                                    fontFamily: 'monospace',
                                    fontSize: '1rem',
                                    resize: 'vertical'
                                }}
                            />
                            <div className="flex-stack-mobile" style={{ display: 'flex', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                                <div className="w-full-mobile" style={{ flex: '1 1 200px' }}>
                                    <label style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: '0.3rem', display: 'block' }}>Start Offset (Optional)</label>
                                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                        <input
                                            type="number"
                                            placeholder="Auto (Random)"
                                            value={advOffset}
                                            onChange={(e) => setAdvOffset(e.target.value)}
                                            style={{
                                                width: '100%',
                                                padding: '0.8rem 2.5rem 0.8rem 1rem',
                                                borderRadius: '8px',
                                                border: '1px solid #475569',
                                                background: '#0f172a',
                                                color: 'white',
                                                appearance: 'textfield'
                                            }}
                                        />
                                        <div style={{ position: 'absolute', right: '4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                            <button
                                                onClick={() => setAdvOffset(prev => (prev === '' ? 1 : parseInt(prev) + 1))}
                                                style={{ background: '#334155', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', padding: '1px', color: '#cbd5e1' }}
                                            >
                                                <ChevronUp size={12} />
                                            </button>
                                            <button
                                                onClick={() => setAdvOffset(prev => (prev === '' ? 0 : Math.max(0, parseInt(prev) - 1)))}
                                                style={{ background: '#334155', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', padding: '1px', color: '#cbd5e1' }}
                                            >
                                                <ChevronDown size={12} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div className="w-full-mobile" style={{ flex: '1 1 200px' }}>
                                    <label style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: '0.3rem', display: 'block' }}>Interval (Optional)</label>
                                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                        <input
                                            type="number"
                                            placeholder="Auto (Random)"
                                            value={advInterval}
                                            onChange={(e) => setAdvInterval(e.target.value)}
                                            style={{
                                                width: '100%',
                                                padding: '0.8rem 2.5rem 0.8rem 1rem',
                                                borderRadius: '8px',
                                                border: '1px solid #475569',
                                                background: '#0f172a',
                                                color: 'white',
                                                appearance: 'textfield'
                                            }}
                                        />
                                        <div style={{ position: 'absolute', right: '4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                            <button
                                                onClick={() => setAdvInterval(prev => (prev === '' ? 1 : parseInt(prev) + 1))}
                                                style={{ background: '#334155', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', padding: '1px', color: '#cbd5e1' }}
                                            >
                                                <ChevronUp size={12} />
                                            </button>
                                            <button
                                                onClick={() => setAdvInterval(prev => (prev === '' ? 1 : Math.max(1, parseInt(prev) - 1)))}
                                                style={{ background: '#334155', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', padding: '1px', color: '#cbd5e1' }}
                                            >
                                                <ChevronDown size={12} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <p style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <AlertCircle size={14} /> Leave blank for randomized keys (Higher Security)
                            </p>
                        </div>
                    )}

                    {/* Advanced Params - Only for Recover */}
                    {/* Advanced Params - Only for Recover */}
                    {advAction === 'recover' && (
                        <div className="flex-stack-mobile" style={{ display: 'flex', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                            <div className="w-full-mobile" style={{ flex: '1 1 200px' }}>
                                <label style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: '0.3rem', display: 'block' }}>Start Offset (Required)</label>
                                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                    <input
                                        type="number"
                                        value={advOffset}
                                        onChange={(e) => setAdvOffset(parseInt(e.target.value) || '')}
                                        placeholder="e.g 1024"
                                        style={{
                                            width: '100%',
                                            padding: '0.8rem 2.5rem 0.8rem 1rem',
                                            borderRadius: '8px',
                                            border: '1px solid #475569',
                                            background: '#0f172a',
                                            color: 'white',
                                            appearance: 'textfield',
                                            minWidth: '0'
                                        }}
                                    />
                                    <div style={{ position: 'absolute', right: '4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                        <button
                                            onClick={() => setAdvOffset(prev => (prev === '' ? 1 : parseInt(prev) + 1))}
                                            style={{ background: '#334155', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', padding: '1px', color: '#cbd5e1' }}
                                        >
                                            <ChevronUp size={12} />
                                        </button>
                                        <button
                                            onClick={() => setAdvOffset(prev => (prev === '' ? 0 : Math.max(0, parseInt(prev) - 1)))}
                                            style={{ background: '#334155', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', padding: '1px', color: '#cbd5e1' }}
                                        >
                                            <ChevronDown size={12} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div className="w-full-mobile" style={{ flex: '1 1 200px' }}>
                                <label style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: '0.3rem', display: 'block' }}>Interval (Required)</label>
                                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                    <input
                                        type="number"
                                        value={advInterval}
                                        onChange={(e) => setAdvInterval(parseInt(e.target.value) || '')}
                                        placeholder="e.g 50"
                                        style={{
                                            width: '100%',
                                            padding: '0.8rem 2.5rem 0.8rem 1rem',
                                            borderRadius: '8px',
                                            border: '1px solid #475569',
                                            background: '#0f172a',
                                            color: 'white',
                                            appearance: 'textfield',
                                            minWidth: '0'
                                        }}
                                    />
                                    <div style={{ position: 'absolute', right: '4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                        <button
                                            onClick={() => setAdvInterval(prev => (prev === '' ? 1 : parseInt(prev) + 1))}
                                            style={{ background: '#334155', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', padding: '1px', color: '#cbd5e1' }}
                                        >
                                            <ChevronUp size={12} />
                                        </button>
                                        <button
                                            onClick={() => setAdvInterval(prev => (prev === '' ? 1 : Math.max(1, parseInt(prev) - 1)))}
                                            style={{ background: '#334155', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', padding: '1px', color: '#cbd5e1' }}
                                        >
                                            <ChevronDown size={12} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <button
                        onClick={handleAdvanced}
                        disabled={!advFile || (advAction === 'hide' && !advMessage) || advLoading}
                        style={{
                            width: '100%',
                            padding: '1rem',
                            background: 'linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%)',
                            color: 'white',
                            fontWeight: 'bold',
                            fontSize: '1rem',
                            opacity: !advFile || (advAction === 'hide' && !advMessage) || advLoading ? 0.7 : 1,
                            cursor: !advFile || (advAction === 'hide' && !advMessage) || advLoading ? 'not-allowed' : 'pointer',
                            borderRadius: '12px',
                            border: 'none',
                            marginTop: '0.5rem',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                        }}
                    >
                        {advLoading ? 'Processing...' : (advAction === 'hide' ? 'Encrypt & Hide' : 'Decrypt & Recover')}
                    </button>

                    {advError && (
                        <div style={{ background: '#450a0a', border: '1px solid #f87171', padding: '1rem', borderRadius: '8px', color: '#fca5a5', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <AlertCircle size={24} style={{ minWidth: '24px' }} />
                            <span style={{ fontWeight: 500 }}>{advError}</span>
                        </div>
                    )}

                    {advResult && (
                        <div style={{ marginTop: '1rem', background: '#0f172a', padding: '1.5rem', borderRadius: '12px', border: '1px solid #1e293b' }}>
                            <h3 style={{ color: '#4ade80', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
                                <CheckCircle size={24} /> Success!
                            </h3>

                            {advResult.type === 'download' ? (
                                <div>
                                    <div style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '12px', marginBottom: '1.5rem', border: '1px solid #f59e0b', position: 'relative' }}>
                                        <div style={{
                                            position: 'absolute',
                                            top: '-12px',
                                            left: '20px',
                                            background: '#f59e0b',
                                            padding: '0.2rem 0.8rem',
                                            borderRadius: '12px',
                                            color: '#1e293b',
                                            fontSize: '0.8rem',
                                            fontWeight: 'bold',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px'
                                        }}>
                                            <AlertCircle size={14} /> SECURITY KEYS
                                        </div>
                                        <p style={{ color: '#cbd5e1', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: '1.5' }}>
                                            Save these keys securely. You <b>MUST</b> use them to recover your message later.
                                        </p>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
                                            <div style={{ background: '#0f172a', padding: '1rem', borderRadius: '8px', textAlign: 'center', border: '1px solid #334155' }}>
                                                <p style={{ color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Start Offset</p>
                                                <p style={{ color: '#e2e8f0', fontSize: '1.8rem', fontWeight: 'bold', fontFamily: 'monospace', margin: 0 }}>{advResult.key_offset}</p>
                                            </div>
                                            <div style={{ background: '#0f172a', padding: '1rem', borderRadius: '8px', textAlign: 'center', border: '1px solid #334155' }}>
                                                <p style={{ color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Interval</p>
                                                <p style={{ color: '#e2e8f0', fontSize: '1.8rem', fontWeight: 'bold', fontFamily: 'monospace', margin: 0 }}>{advResult.key_interval}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => handleDownload(`${API_URL}/${advResult.url}`, advResult.filename)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            background: '#10b981',
                                            padding: '0.8rem 1.5rem',
                                            borderRadius: '8px',
                                            border: 'none',
                                            color: 'white',
                                            cursor: 'pointer',
                                            width: '100%',
                                            justifyContent: 'center',
                                            fontWeight: 600,
                                            fontSize: '1rem'
                                        }}
                                    >
                                        <Download size={20} /> Download Stego-Image
                                    </button>
                                </div>
                            ) : (
                                <div>
                                    <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Recovered Message Content:</p>
                                    <div style={{
                                        padding: '1.5rem',
                                        background: '#1e293b',
                                        border: '1px solid #334155',
                                        borderRadius: '8px',
                                        color: '#e2e8f0',
                                        fontFamily: 'monospace',
                                        whiteSpace: 'pre-wrap',
                                        fontSize: '1.1rem',
                                        lineHeight: '1.6'
                                    }}>
                                        {advResult.text}
                                    </div>
                                    <button
                                        onClick={() => navigator.clipboard.writeText(advResult.text)}
                                        style={{
                                            marginTop: '1rem',
                                            background: 'transparent',
                                            border: '1px solid #475569',
                                            color: '#cbd5e1',
                                            padding: '0.5rem 1rem',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            fontSize: '0.9rem'
                                        }}
                                    >
                                        Copy to Clipboard
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

        </div >
    )

}

export default App
