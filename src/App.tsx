import * as React from "react"
import { useState, useEffect } from "react";
import { 
  Plus, 
  Search, 
  BookOpen, 
  Upload, 
  Trash2, 
  ChevronRight, 
  ExternalLink,
  Loader2,
  FileText,
  Tag as TagIcon,
  User,
  Hash,
  Copy,
  Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { summarizePDF, MODELS, SummaryResult } from "@/src/lib/gemini";
import { db, handleFirestoreError } from "@/src/lib/firebase";
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc,
  serverTimestamp 
} from "firebase/firestore";
import confetti from "canvas-confetti";

// Types for our "Public Library"
interface LocalSummary extends SummaryResult {
  id: string;
  contributor: string;
  timestamp: number;
  model: string;
}

export default function App() {
  const [search, setSearch] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [summaries, setSummaries] = useState<LocalSummary[]>([]);
  const [selectedModel, setSelectedModel] = useState("gemini-3.1-flash-lite-preview");
  const [contributorName, setContributorName] = useState("");
  const [selectedSummary, setSelectedSummary] = useState<LocalSummary | null>(null);
  const [copied, setCopied] = useState(false);

  // Real-time synchronization
  useEffect(() => {
    const q = query(collection(db, "summaries"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const items = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as LocalSummary[];
        setSummaries(items);
      },
      (error) => {
        console.error("Firestore sync error:", error);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleCopy = () => {
    if (!selectedSummary) return;
    const text = `
Title: ${selectedSummary.title}
Author: ${selectedSummary.author}
Thesis: ${selectedSummary.thesis}
Key Arguments:
${selectedSummary.keyArguments.map((a, i) => `${i + 1}. ${a}`).join("\n")}
Thematic Synthesis: ${selectedSummary.thematicSynthesis}
    `.trim();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      alert("Please upload a PDF file.");
      return;
    }

    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        const result = await summarizePDF(base64, selectedModel);
        
        const summaryData = {
          ...result,
          contributor: contributorName || "Anonymous",
          timestamp: Date.now(), // Firestore rules expect number based on blueprint
          model: MODELS.find(m => m.id === selectedModel)?.name || selectedModel,
        };

        try {
          await addDoc(collection(db, "summaries"), summaryData);
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 }
          });
        } catch (dbErr) {
          handleFirestoreError(dbErr, 'create', 'summaries');
        }

        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error(error);
      alert("Failed to summarize PDF. Check console for details.");
      setIsUploading(false);
    }
  };

  const filteredSummaries = summaries.filter(s => 
    s.title.toLowerCase().includes(search.toLowerCase()) ||
    s.tags.some(t => t.toLowerCase().includes(search.toLowerCase())) ||
    s.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-editorial-bg text-editorial-ink font-serif relative border-[12px] border-editorial-accent flex flex-col">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-center px-6 md:px-12 py-8 border-b border-editorial-line bg-editorial-bg/80 backdrop-blur-sm sticky top-0 z-20 gap-6">
        <div className="flex flex-col">
          <span className="editorial-label mb-1">Synapse & Soul Archive</span>
          <h1 className="text-4xl font-light italic tracking-tight leading-none">The Simple Workflow</h1>
        </div>
        
        <div className="flex items-center gap-6 flex-wrap justify-center">
          <div className="flex flex-col items-end">
            <span className="editorial-label mb-1">AI Engine Selection</span>
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger className="bg-transparent border-none border-b border-editorial-ink rounded-none h-auto py-1 px-0 font-sans text-xs focus:ring-0 focus:border-editorial-ink transition-all w-48">
                <SelectValue placeholder="Select Engine" />
              </SelectTrigger>
              <SelectContent className="bg-editorial-bg border-editorial-line font-sans">
                {MODELS.map(m => (
                  <SelectItem key={m.id} value={m.id} className="text-xs">{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <Dialog>
            <DialogTrigger render={
              <Button className="px-8 py-2 bg-editorial-ink text-white font-sans text-[11px] uppercase tracking-[0.2em] hover:bg-neutral-800 transition-colors rounded-none h-auto">
                <Plus className="w-3 h-3 mr-2" />
                Upload PDF
              </Button>
            } />
            <DialogContent className="sm:max-w-md bg-editorial-bg border-editorial-line p-0 rounded-none overflow-hidden">
              <div className="p-8 border-b border-editorial-line">
                <DialogHeader className="space-y-2">
                  <span className="editorial-label">Extraction Panel</span>
                  <DialogTitle className="text-3xl font-light italic">Research Ingestion</DialogTitle>
                  <DialogDescription className="font-serif italic text-editorial-secondary">
                    Provide original metadata to categorize the intellectual nutrition.
                  </DialogDescription>
                </DialogHeader>
              </div>
              <div className="p-8 space-y-8 bg-editorial-accent/20">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="editorial-label">Contributor Identifier</label>
                    <Input 
                      placeholder="Name or 'Anonymous'" 
                      value={contributorName}
                      onChange={(e) => setContributorName(e.target.value)}
                      className="border-none border-b border-editorial-line bg-transparent rounded-none px-0 focus:ring-0 focus:border-editorial-ink font-sans placeholder-editorial-muted/50"
                    />
                  </div>
                  
                  <div className="relative group mt-6">
                    {isUploading ? (
                      <div className="flex flex-col items-center justify-center p-12 bg-white/50 border border-editorial-line animate-pulse space-y-4">
                        <Loader2 className="w-8 h-8 animate-spin text-editorial-ink" />
                        <div className="text-center">
                          <p className="editorial-label">Processing Lexicon</p>
                          <p className="text-sm italic font-serif opacity-60">Wait precisely while AI scans the text.</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center border border-editorial-line p-12 bg-editorial-bg hover:bg-white transition-all group cursor-pointer relative overflow-hidden">
                        <Upload className="w-8 h-8 mb-4 text-editorial-muted group-hover:text-editorial-ink transition-colors" />
                        <p className="text-center mb-6">
                          <span className="text-sm font-bold uppercase tracking-widest font-sans">Select Manuscript</span><br />
                          <span className="text-[10px] italic text-editorial-muted font-serif">PDF Format • Max 20MB</span>
                        </p>
                        <Input 
                          type="file" 
                          accept=".pdf" 
                          className="absolute inset-0 opacity-0 cursor-pointer z-10"
                          onChange={handleUpload}
                        />
                        <div className="h-0.5 w-0 bg-editorial-ink absolute bottom-0 left-0 group-hover:w-full transition-all duration-700"></div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row flex-grow">
        {/* Sidebar */}
        <aside className="w-full lg:w-80 border-r border-editorial-line p-8 md:p-12 space-y-12 bg-editorial-accent/30 overflow-y-auto">
          <div>
            <span className="editorial-label block mb-4">Search Library</span>
            <div className="relative">
              <Search className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 text-editorial-muted" />
              <Input 
                placeholder="Neuroscience, Ethics..." 
                className="border-none border-b border-editorial-ink rounded-none bg-transparent pl-6 h-10 w-full focus:ring-0 font-sans text-sm placeholder-editorial-muted/50"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div>
            <span className="editorial-label block mb-6">Library Metrics</span>
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-6">
              <div className="flex flex-col">
                <span className="text-4xl font-light italic mb-1">{summaries.length}</span>
                <span className="editorial-label text-[9px]">Insight Records</span>
              </div>
              <div className="flex flex-col">
                <span className="text-4xl font-light italic mb-1">{new Set(summaries.map(s => s.category)).size}</span>
                <span className="editorial-label text-[9px]">Scholarly Categories</span>
              </div>
            </div>
          </div>

          <div className="p-8 bg-editorial-ink text-white space-y-4">
            <p className="text-xs italic leading-relaxed opacity-80 font-serif">
              \"Providing intellectual nutrition by breaking through academic paywalls.\"
            </p>
            <div className="h-px w-8 bg-white/30"></div>
          </div>
        </aside>

        {/* Gallery */}
        <main className="flex-grow p-8 md:p-16 overflow-y-auto bg-editorial-bg">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-12">
            {summaries.length === 0 && !isUploading && (
              <div className="col-span-full border border-editorial-line p-20 flex flex-col items-center justify-center text-center italic bg-editorial-accent/10">
                <FileText className="w-12 h-12 mb-6 opacity-10" />
                <h2 className="text-2xl font-light mb-2">The Archive is Quiet.</h2>
                <p className="text-sm text-editorial-secondary max-w-sm">
                  Upload an academic PDF to begin the process of extraction and insight preservation.
                </p>
              </div>
            )}

            {isUploading && (
              <div className="border border-editorial-line p-8 space-y-6 animate-pulse">
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-12 bg-editorial-accent" />
                  <Skeleton className="h-3 w-16 bg-editorial-accent" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-6 w-full bg-editorial-accent" />
                  <Skeleton className="h-6 w-2/3 bg-editorial-accent" />
                </div>
                <Skeleton className="h-4 w-1/3 bg-editorial-accent" />
                <div className="space-y-1">
                  <Skeleton className="h-3 w-full bg-editorial-accent" />
                  <Skeleton className="h-3 w-full bg-editorial-accent" />
                </div>
              </div>
            )}

            {summaries.filter(s => 
              s.title.toLowerCase().includes(search.toLowerCase()) ||
              s.tags.some(t => t.toLowerCase().includes(search.toLowerCase())) ||
              s.category.toLowerCase().includes(search.toLowerCase())
            ).map((summary) => (
              <div 
                key={summary.id} 
                className="group cursor-pointer flex flex-col space-y-5 group"
                onClick={() => setSelectedSummary(summary)}
              >
                <div className="flex justify-between items-center">
                  <div className="flex gap-2">
                    <span className="px-2 py-0.5 border border-editorial-ink text-[8px] font-sans font-extrabold uppercase tracking-widest leading-none">
                      {summary.category}
                    </span>
                    <span className="px-2 py-0.5 bg-editorial-ink text-white text-[8px] font-sans font-extrabold uppercase tracking-widest leading-none">
                      {summary.documentType}
                    </span>
                  </div>
                  <span className="text-[9px] font-sans text-editorial-muted uppercase tracking-widest font-bold">
                    {new Date(summary.timestamp).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                  </span>
                </div>
                
                <h3 className="text-2xl font-light leading-tight group-hover:italic transition-all duration-300">
                  {summary.title}
                </h3>
                
                <div className="flex items-center gap-2 text-[10px] text-editorial-secondary font-sans font-bold uppercase tracking-widest">
                  <User className="w-3 h-3 text-editorial-muted" />
                  <span>{summary.author}</span>
                </div>

                <p className="text-sm font-serif italic text-editorial-secondary line-clamp-3 leading-relaxed border-l-2 border-editorial-accent pl-4">
                  {summary.thesis}
                </p>

                <div className="flex flex-wrap gap-2 pt-2">
                  {summary.tags.slice(0, 2).map(tag => (
                    <span key={tag} className="text-[9px] text-editorial-muted font-sans font-bold uppercase tracking-wider">#{tag}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>

      {/* Footer */}
      <footer className="bg-editorial-ink text-white h-12 flex items-center justify-between px-12 z-20 shrink-0">
        <div className="text-[9px] uppercase tracking-[0.2em] font-sans font-bold">
          Database: Persistent Insight • Status: Archive Ready
        </div>
        <div className="text-[9px] uppercase tracking-[0.2em] font-sans font-bold opacity-60">
          Synapse & Soul © {new Date().getFullYear()}
        </div>
      </footer>

      {/* Summary Viewer Dialog */}
      <Dialog open={!!selectedSummary} onOpenChange={(open) => !open && setSelectedSummary(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] bg-editorial-bg border-editorial-line p-0 overflow-hidden flex flex-col rounded-none shadow-2xl">
          {selectedSummary && (
            <>
              <ScrollArea className="flex-grow">
                <main className="p-10 md:p-20">
                  <div className="max-w-3xl mx-auto">
                    <div className="mb-12">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-4">
                          <div className="flex gap-2">
                            <span className="px-2 py-0.5 border border-editorial-ink text-[9px] font-sans font-bold uppercase tracking-widest">
                              {selectedSummary.category}
                            </span>
                            <span className="px-2 py-0.5 bg-editorial-ink text-white text-[9px] font-sans font-bold uppercase tracking-widest">
                              {selectedSummary.documentType}
                            </span>
                          </div>
                          <span className="text-[10px] font-sans font-bold text-editorial-muted uppercase tracking-widest">
                            Preserved by {selectedSummary.contributor} • {new Date(selectedSummary.timestamp).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={handleCopy} className="h-8 gap-2 text-xs font-sans font-bold text-editorial-muted hover:text-editorial-ink uppercase tracking-widest h-auto py-0 px-2">
                            {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                            {copied ? "Preserved" : "Preserve Copy"}
                          </Button>
                        </div>
                      </div>
                      <h2 className="text-5xl font-light mb-6 leading-[1.1] text-editorial-ink">
                        {selectedSummary.title}
                      </h2>
                      <p className="text-xl italic text-editorial-secondary font-serif">
                        {selectedSummary.author}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-16">
                      <div className="md:col-span-7 space-y-12">
                        <div>
                          <h4 className="editorial-label border-b border-editorial-line pb-3 mb-6">Core Thesis</h4>
                          <p className="text-lg leading-relaxed text-editorial-ink italic font-serif">
                            {selectedSummary.thesis}
                          </p>
                        </div>
                        <div>
                          <h4 className="editorial-label border-b border-editorial-line pb-3 mb-6">Thematic Synthesis</h4>
                          <p className="text-base leading-relaxed text-editorial-secondary">
                            {selectedSummary.thematicSynthesis}
                          </p>
                        </div>
                      </div>

                      <div className="md:col-span-5">
                        <h4 className="editorial-label border-b border-editorial-line pb-3 mb-6 text-editorial-ink">Key Arguments</h4>
                        <ul className="space-y-6 text-sm leading-relaxed text-editorial-ink">
                          {selectedSummary.keyArguments.map((arg, idx) => (
                            <li key={idx} className="flex gap-4">
                              <span className="font-sans font-bold text-xs text-editorial-muted pt-0.5">{String(idx + 1).padStart(2, '0')}</span>
                              <span>{arg}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <Separator className="my-16 bg-editorial-line" />

                    <div>
                      <h4 className="editorial-label mb-4 opacity-50">Archive Tags</h4>
                      <div className="flex flex-wrap gap-3">
                        {selectedSummary.tags.map(tag => (
                          <span key={tag} className="px-3 py-1 bg-editorial-accent text-[11px] font-sans font-bold uppercase tracking-wider text-editorial-muted">
                            #{tag.toLowerCase()}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </main>
              </ScrollArea>
              <div className="h-1 bg-editorial-ink"></div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

