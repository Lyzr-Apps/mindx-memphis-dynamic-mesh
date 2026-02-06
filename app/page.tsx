'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { callAIAgent, uploadFiles } from '@/lib/aiAgent'
import { Loader2, Send, ArrowLeft, ArrowRight, Trophy, Flame, Target, MessageCircle, CheckCircle, Upload, X, Users, Clock, Award, TrendingUp, Zap, Lock, User, AlertCircle } from 'lucide-react'

// TypeScript interfaces from actual test responses
interface NirvanaResponse {
  detected_stressor?: string
  routed_to_agent?: string
  context_summary?: string
  crisis_detected?: boolean
  response_message?: string
  suggested_techniques?: string[]
  escalation_needed?: boolean
}

interface RecommendedTask {
  task_title: string
  task_description: string
  category: string
  difficulty: 'easy' | 'medium' | 'hard'
  estimated_time: string
  points_value: number
  verification_method: string
  expected_benefit: string
  personalization_reason: string
}

interface TaskResponse {
  recommended_tasks?: RecommendedTask[]
  total_tasks_recommended?: number
  priority_focus?: string
  encouragement_message?: string
}

interface ImageVerificationResponse {
  verification_status: 'approved' | 'rejected' | 'pending'
  points_awarded: number
  confidence_score: number
  image_analysis: string
  task_match: boolean
  fraud_detected: boolean
  feedback_message: string
  rejection_reason?: string
}

interface PodModerationResponse {
  moderation_decision: string
  severity_level: string
  violation_category: string
  requires_human_review: boolean
  alert_moderators: boolean
  content_analysis: string
  reasoning: string
  suggested_action: string
  user_warning_message?: string
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  crisis?: boolean
}

interface UserData {
  username: string
  points: number
  streak: number
  level: number
  phq9Score?: number
  gad7Score?: number
  completedTasks: string[]
  activeChallenges: string[]
}

interface Challenge {
  id: string
  name: string
  description: string
  points: number
  participants: number
  duration: string
  deadline: string
  progress: number
  active?: boolean
}

interface Pod {
  id: string
  name: string
  topic: string
  participants: number
  tags: string[]
  messages: PodMessage[]
}

interface PodMessage {
  id: string
  username: string
  content: string
  timestamp: string
  flagged?: boolean
}

// Agent IDs
const AGENTS = {
  NIRVANA_ORCHESTRATOR: '6985a1d78ce1fc653cfdee3e',
  TASK_RECOMMENDATION: '6985a1fb7551cb7920ffe9c1',
  IMAGE_VERIFICATION: '6985a22db37fff3a03c07c51',
  POD_MODERATION: '6985a256f7f7d3ffa5d8664d',
}

// PHQ-9 and GAD-7 Questions
const PHQ9_QUESTIONS = [
  'Little interest or pleasure in doing things',
  'Feeling down, depressed, or hopeless',
  'Trouble falling or staying asleep, or sleeping too much',
  'Feeling tired or having little energy',
  'Poor appetite or overeating',
  'Feeling bad about yourself - or that you are a failure',
  'Trouble concentrating on things',
  'Moving or speaking slowly, or being fidgety or restless',
  'Thoughts that you would be better off dead, or of hurting yourself'
]

const GAD7_QUESTIONS = [
  'Feeling nervous, anxious, or on edge',
  'Not being able to stop or control worrying',
  'Worrying too much about different things',
  'Trouble relaxing',
  'Being so restless that it is hard to sit still',
  'Becoming easily annoyed or irritable',
  'Feeling afraid, as if something awful might happen'
]

const ANSWER_OPTIONS = [
  { label: 'Not at all', value: 0 },
  { label: 'Several days', value: 1 },
  { label: 'More than half the days', value: 2 },
  { label: 'Nearly every day', value: 3 }
]

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [loginUsername, setLoginUsername] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [currentScreen, setCurrentScreen] = useState<string>('home')
  const [userData, setUserData] = useState<UserData>({
    username: 'Anonymous User',
    points: 0,
    streak: 0,
    level: 1,
    completedTasks: [],
    activeChallenges: []
  })

  // Onboarding state
  const [onboardingStep, setOnboardingStep] = useState(0)
  const [phq9Answers, setPHQ9Answers] = useState<number[]>(Array(9).fill(-1))
  const [gad7Answers, setGAD7Answers] = useState<number[]>(Array(7).fill(-1))
  const [showConfetti, setShowConfetti] = useState(false)

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Task state
  const [tasks, setTasks] = useState<RecommendedTask[]>([])
  const [selectedTask, setSelectedTask] = useState<RecommendedTask | null>(null)
  const [taskLoading, setTaskLoading] = useState(false)
  const [uploadedImage, setUploadedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [taskSuccess, setTaskSuccess] = useState<{ show: boolean; points: number; message: string }>({ show: false, points: 0, message: '' })

  // Challenge state
  const [challenges, setChallenges] = useState<Challenge[]>([
    {
      id: '1',
      name: '7-Day Meditation Sprint',
      description: 'Meditate for at least 10 minutes every day for a week',
      points: 200,
      participants: 156,
      duration: '7 days',
      deadline: '2026-02-13',
      progress: 0
    },
    {
      id: '2',
      name: 'Gratitude Journal Challenge',
      description: 'Write 3 things you\'re grateful for each day',
      points: 150,
      participants: 243,
      duration: '5 days',
      deadline: '2026-02-11',
      progress: 0
    },
    {
      id: '3',
      name: 'Social Connection Week',
      description: 'Reach out to someone different each day',
      points: 180,
      participants: 189,
      duration: '7 days',
      deadline: '2026-02-13',
      progress: 0
    }
  ])

  // Pod state
  const [pods, setPods] = useState<Pod[]>([
    {
      id: '1',
      name: 'Exam Stress Support',
      topic: 'Academic Pressure',
      participants: 45,
      tags: ['JEE', 'NEET', 'Study Tips'],
      messages: []
    },
    {
      id: '2',
      name: 'Work-Life Balance',
      topic: 'Career & Life',
      participants: 38,
      tags: ['Career', 'Balance', 'Burnout'],
      messages: []
    },
    {
      id: '3',
      name: 'Anxiety Circle',
      topic: 'Mental Health',
      participants: 62,
      tags: ['Anxiety', 'Coping', 'Support'],
      messages: []
    }
  ])
  const [activePod, setActivePod] = useState<Pod | null>(null)
  const [podInput, setPodInput] = useState('')

  // Leaderboard state
  const [leaderboard, setLeaderboard] = useState([
    { rank: 1, username: 'MindfulWarrior', points: 2450, badges: 12 },
    { rank: 2, username: 'ZenMaster99', points: 2180, badges: 10 },
    { rank: 3, username: 'PeacefulSoul', points: 1950, badges: 9 },
    { rank: 4, username: 'CalmSeeker', points: 1720, badges: 8 },
    { rank: 5, username: 'WellnessJourney', points: 1590, badges: 7 },
    { rank: 6, username: 'BalancedLife', points: 1420, badges: 6 },
    { rank: 7, username: 'HappyVibes', points: 1280, badges: 5 },
    { rank: 8, username: 'InnerPeace', points: 1150, badges: 5 },
  ])

  // Load user data from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('mindx_user_data')
    if (saved) {
      const data = JSON.parse(saved)
      setUserData(data)
      if (data.phq9Score !== undefined && data.gad7Score !== undefined) {
        setCurrentScreen('dashboard')
      }
    }
  }, [])

  // Save user data to localStorage
  useEffect(() => {
    localStorage.setItem('mindx_user_data', JSON.stringify(userData))
  }, [userData])

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  // Login handler
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError('')

    if (loginUsername === 'demo' && loginPassword === '12345678') {
      setIsLoggedIn(true)
      setUserData(prev => ({ ...prev, username: 'Demo User' }))
      setCurrentScreen('onboarding')
    } else {
      setLoginError('Invalid credentials. Use username: demo, password: 12345678')
    }
  }

  // Onboarding handlers
  const handleOnboardingAnswer = (value: number) => {
    if (onboardingStep < 9) {
      const newAnswers = [...phq9Answers]
      newAnswers[onboardingStep] = value
      setPHQ9Answers(newAnswers)
    } else {
      const newAnswers = [...gad7Answers]
      newAnswers[onboardingStep - 9] = value
      setGAD7Answers(newAnswers)
    }
  }

  const handleOnboardingNext = () => {
    if (onboardingStep < 15) {
      setOnboardingStep(onboardingStep + 1)
    } else {
      // Calculate scores
      const phq9Score = phq9Answers.reduce((a, b) => a + b, 0)
      const gad7Score = gad7Answers.reduce((a, b) => a + b, 0)

      setUserData(prev => ({ ...prev, phq9Score, gad7Score }))
      setShowConfetti(true)

      setTimeout(() => {
        setShowConfetti(false)
        setCurrentScreen('dashboard')
      }, 3000)
    }
  }

  const handleOnboardingBack = () => {
    if (onboardingStep > 0) {
      setOnboardingStep(onboardingStep - 1)
    }
  }

  const canProceed = () => {
    if (onboardingStep < 9) {
      return phq9Answers[onboardingStep] !== -1
    } else {
      return gad7Answers[onboardingStep - 9] !== -1
    }
  }

  // Chat handlers
  const handleSendMessage = async () => {
    if (!chatInput.trim() || chatLoading) return

    const userMessage = chatInput.trim()
    setChatInput('')
    setChatLoading(true)

    // Add user message
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }])

    try {
      // Call Nirvana Orchestrator
      const result = await callAIAgent(userMessage, AGENTS.NIRVANA_ORCHESTRATOR)

      if (result.success && result.response.result) {
        const nirvanaData = result.response.result as NirvanaResponse

        // Check for crisis
        const isCrisis = nirvanaData.crisis_detected || false

        // Get response message
        let responseText = nirvanaData.response_message ||
                          nirvanaData.context_summary ||
                          'I understand. Let me help you with that.'

        // Add assistant message
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: responseText,
          crisis: isCrisis
        }])
      } else {
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: 'I\'m here to support you. How are you feeling today?'
        }])
      }
    } catch (error) {
      console.error('Chat error:', error)
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: 'I\'m here for you. Please tell me more about what you\'re experiencing.'
      }])
    }

    setChatLoading(false)
  }

  // Task handlers
  const handleGetTasks = async () => {
    setTaskLoading(true)
    try {
      const message = `PHQ-9 score: ${userData.phq9Score || 0}, GAD-7 score: ${userData.gad7Score || 0}, user profile: student experiencing stress`
      const result = await callAIAgent(message, AGENTS.TASK_RECOMMENDATION)

      if (result.success && result.response.result) {
        const taskData = result.response.result as TaskResponse
        if (taskData.recommended_tasks) {
          setTasks(taskData.recommended_tasks)
        }
      }
    } catch (error) {
      console.error('Task error:', error)
    }
    setTaskLoading(false)
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setUploadedImage(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSubmitProof = async () => {
    if (!uploadedImage || !selectedTask) return

    setSubmitting(true)
    try {
      // Upload image
      const uploadResult = await uploadFiles(uploadedImage)

      if (uploadResult.success && uploadResult.asset_ids.length > 0) {
        // Verify with agent
        const message = `Task: ${selectedTask.task_title}. Verify completion from uploaded image.`
        const result = await callAIAgent(message, AGENTS.IMAGE_VERIFICATION, {
          assets: uploadResult.asset_ids
        })

        if (result.success && result.response.result) {
          const verificationData = result.response.result as ImageVerificationResponse

          if (verificationData.verification_status === 'approved') {
            const points = verificationData.points_awarded || selectedTask.points_value

            // Award points
            setUserData(prev => ({
              ...prev,
              points: prev.points + points,
              completedTasks: [...prev.completedTasks, selectedTask.task_title]
            }))

            // Show success modal
            setTaskSuccess({
              show: true,
              points,
              message: verificationData.feedback_message || 'Great job! Keep up the amazing work on your wellness journey!'
            })
          }
        }
      }
    } catch (error) {
      console.error('Submit proof error:', error)
    }
    setSubmitting(false)
  }

  // Pod handlers
  const handleSendPodMessage = async () => {
    if (!podInput.trim() || !activePod) return

    const messageContent = podInput.trim()
    setPodInput('')

    // Create message
    const newMessage: PodMessage = {
      id: Date.now().toString(),
      username: userData.username,
      content: messageContent,
      timestamp: new Date().toISOString()
    }

    // Add to pod
    setPods(prev => prev.map(pod =>
      pod.id === activePod.id
        ? { ...pod, messages: [...pod.messages, newMessage] }
        : pod
    ))

    // Moderate message
    try {
      const result = await callAIAgent(
        `Pod message: '${messageContent}'`,
        AGENTS.POD_MODERATION
      )

      if (result.success && result.response.result) {
        const modData = result.response.result as PodModerationResponse

        if (modData.severity_level === 'critical') {
          // Flag message and show alert
          setPods(prev => prev.map(pod =>
            pod.id === activePod.id
              ? {
                  ...pod,
                  messages: pod.messages.map(msg =>
                    msg.id === newMessage.id ? { ...msg, flagged: true } : msg
                  )
                }
              : pod
          ))
        }
      }
    } catch (error) {
      console.error('Moderation error:', error)
    }
  }

  // Render screens
  const renderLogin = () => {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#F8F8FF] via-[#FFD93D]/10 to-[#4ECDC4]/10 overflow-hidden flex items-center justify-center p-4">
        {/* Animated Background Shapes */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-32 h-32 bg-[#FF6B6B]/20 rounded-full animate-pulse"></div>
          <div className="absolute top-40 right-20 w-24 h-24 bg-[#4ECDC4]/20 rotate-45 animate-bounce" style={{ animationDelay: '0.5s' }}></div>
          <div className="absolute bottom-40 left-1/4 w-40 h-40 bg-[#FFD93D]/20 rounded-full animate-pulse" style={{ animationDelay: '1s' }}></div>
          <div className="absolute bottom-20 right-1/3 w-28 h-28 bg-[#FF6B6B]/20 rotate-12 animate-bounce" style={{ animationDelay: '1.5s' }}></div>
        </div>

        <div className="relative z-10 w-full max-w-md">
          <Card className="border-0 shadow-[12px_12px_0px_#FF6B6B] rounded-[25px] bg-white/95 backdrop-blur-sm">
            <CardHeader className="text-center pb-4">
              {/* Logo */}
              <div className="inline-block mx-auto mb-4">
                <div className="w-20 h-20 bg-gradient-to-br from-[#FF6B6B] to-[#4ECDC4] rounded-[20px] shadow-[6px_6px_0px_#FFD93D] flex items-center justify-center">
                  <Zap className="w-10 h-10 text-white" />
                </div>
              </div>
              <CardTitle className="font-fredoka text-4xl text-[#FF6B6B] tracking-wider mb-2">
                mindX
              </CardTitle>
              <p className="text-gray-600">Mental Wellness Platform</p>
            </CardHeader>
            <CardContent className="px-8 pb-8">
              <form onSubmit={handleLogin} className="space-y-6">
                {/* Username Input */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <User className="w-4 h-4 text-[#4ECDC4]" />
                    Username
                  </label>
                  <Input
                    type="text"
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    placeholder="Enter username"
                    className="rounded-[20px] border-2 border-gray-200 focus:border-[#4ECDC4] h-12"
                    required
                  />
                </div>

                {/* Password Input */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Lock className="w-4 h-4 text-[#FF6B6B]" />
                    Password
                  </label>
                  <Input
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Enter password"
                    className="rounded-[20px] border-2 border-gray-200 focus:border-[#FF6B6B] h-12"
                    required
                  />
                </div>

                {/* Error Message */}
                {loginError && (
                  <div className="bg-red-50 border-2 border-red-300 rounded-[15px] p-3 flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-700">{loginError}</p>
                  </div>
                )}

                {/* Demo Credentials Info */}
                <div className="bg-[#FFD93D]/20 border-2 border-[#FFD93D] rounded-[15px] p-3">
                  <p className="text-sm text-gray-700 font-medium mb-1">Demo Credentials:</p>
                  <p className="text-xs text-gray-600">Username: <span className="font-mono font-bold">demo</span></p>
                  <p className="text-xs text-gray-600">Password: <span className="font-mono font-bold">12345678</span></p>
                </div>

                {/* Login Button */}
                <Button
                  type="submit"
                  className="w-full rounded-[20px] bg-gradient-to-r from-[#FF6B6B] to-[#4ECDC4] hover:from-[#ff5252] hover:to-[#3db8b0] shadow-[6px_6px_0px_#FFD93D] hover:shadow-[8px_8px_0px_#FFD93D] transition-all h-12 text-lg font-fredoka tracking-wider"
                >
                  Login
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const renderHome = () => {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#F8F8FF] via-[#FFD93D]/10 to-[#4ECDC4]/10 overflow-hidden">
        {/* Animated Background Shapes */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-32 h-32 bg-[#FF6B6B]/20 rounded-full animate-pulse"></div>
          <div className="absolute top-40 right-20 w-24 h-24 bg-[#4ECDC4]/20 rotate-45 animate-bounce" style={{ animationDelay: '0.5s' }}></div>
          <div className="absolute bottom-40 left-1/4 w-40 h-40 bg-[#FFD93D]/20 rounded-full animate-pulse" style={{ animationDelay: '1s' }}></div>
          <div className="absolute bottom-20 right-1/3 w-28 h-28 bg-[#FF6B6B]/20 rotate-12 animate-bounce" style={{ animationDelay: '1.5s' }}></div>
        </div>

        {/* Header with Login Button */}
        <div className="relative z-10 w-full p-6">
          <div className="max-w-6xl mx-auto flex justify-end">
            <Button
              onClick={() => setCurrentScreen('login')}
              className="rounded-[20px] bg-white text-[#FF6B6B] border-2 border-[#FF6B6B] hover:bg-[#FF6B6B] hover:text-white shadow-[4px_4px_0px_#4ECDC4] hover:shadow-[6px_6px_0px_#4ECDC4] transition-all px-6 py-2 font-fredoka"
            >
              Login
            </Button>
          </div>
        </div>

        <div className="relative z-10 min-h-screen flex items-center justify-center p-4 -mt-20">
          <div className="max-w-6xl w-full">
            <div className="text-center mb-12 animate-fade-in">
              {/* Logo/Icon */}
              <div className="inline-block mb-6">
                <div className="w-24 h-24 mx-auto bg-gradient-to-br from-[#FF6B6B] to-[#4ECDC4] rounded-[25px] shadow-[8px_8px_0px_#FFD93D] flex items-center justify-center transform hover:scale-105 transition-transform">
                  <Zap className="w-12 h-12 text-white" />
                </div>
              </div>

              {/* Hero Text */}
              <h1 className="font-fredoka text-6xl md:text-7xl text-[#FF6B6B] tracking-wider mb-4 animate-slide-up">
                mindX
              </h1>
              <p className="font-fredoka text-2xl md:text-3xl text-[#4ECDC4] tracking-wide mb-6 animate-slide-up" style={{ animationDelay: '0.2s' }}>
                Your Mental Wellness Companion
              </p>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-12 animate-slide-up" style={{ animationDelay: '0.4s' }}>
                Culturally-intelligent AI support designed for Indian students and professionals.
                Build healthy habits, connect with peers, and thrive on your wellness journey.
              </p>

              {/* CTA Button */}
              <Button
                onClick={() => setCurrentScreen('onboarding')}
                className="rounded-[25px] bg-gradient-to-r from-[#FF6B6B] to-[#4ECDC4] hover:from-[#ff5252] hover:to-[#3db8b0] shadow-[8px_8px_0px_#FFD93D] hover:shadow-[12px_12px_0px_#FFD93D] transition-all px-12 py-6 text-xl font-fredoka tracking-wider animate-slide-up"
                style={{ animationDelay: '0.6s' }}
              >
                Start Your Journey
                <ArrowRight className="w-6 h-6 ml-2" />
              </Button>
            </div>

            {/* Feature Cards */}
            <div className="grid md:grid-cols-4 gap-6 mt-16">
              <Card className="border-0 shadow-[6px_6px_0px_#FF6B6B] rounded-[20px] bg-white/80 backdrop-blur-sm hover:shadow-[10px_10px_0px_#FF6B6B] transition-all transform hover:-translate-y-2 animate-fade-in" style={{ animationDelay: '0.8s' }}>
                <CardContent className="p-6 text-center">
                  <div className="w-16 h-16 mx-auto bg-[#FF6B6B]/20 rounded-full flex items-center justify-center mb-4">
                    <MessageCircle className="w-8 h-8 text-[#FF6B6B]" />
                  </div>
                  <h3 className="font-fredoka text-lg text-[#FF6B6B] mb-2">AI Support</h3>
                  <p className="text-sm text-gray-600">Chat with Nirvana for culturally-aware mental health guidance</p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-[6px_6px_0px_#4ECDC4] rounded-[20px] bg-white/80 backdrop-blur-sm hover:shadow-[10px_10px_0px_#4ECDC4] transition-all transform hover:-translate-y-2 animate-fade-in" style={{ animationDelay: '1s' }}>
                <CardContent className="p-6 text-center">
                  <div className="w-16 h-16 mx-auto bg-[#4ECDC4]/20 rounded-full flex items-center justify-center mb-4">
                    <Target className="w-8 h-8 text-[#4ECDC4]" />
                  </div>
                  <h3 className="font-fredoka text-lg text-[#4ECDC4] mb-2">Wellness Tasks</h3>
                  <p className="text-sm text-gray-600">Complete personalized tasks and earn points for your progress</p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-[6px_6px_0px_#FFD93D] rounded-[20px] bg-white/80 backdrop-blur-sm hover:shadow-[10px_10px_0px_#FFD93D] transition-all transform hover:-translate-y-2 animate-fade-in" style={{ animationDelay: '1.2s' }}>
                <CardContent className="p-6 text-center">
                  <div className="w-16 h-16 mx-auto bg-[#FFD93D]/20 rounded-full flex items-center justify-center mb-4">
                    <Flame className="w-8 h-8 text-[#FF6B6B]" />
                  </div>
                  <h3 className="font-fredoka text-lg text-[#FF6B6B] mb-2">Soul Sprints</h3>
                  <p className="text-sm text-gray-600">Join gamified challenges and build lasting wellness habits</p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-[6px_6px_0px_#FF6B6B] rounded-[20px] bg-white/80 backdrop-blur-sm hover:shadow-[10px_10px_0px_#FF6B6B] transition-all transform hover:-translate-y-2 animate-fade-in" style={{ animationDelay: '1.4s' }}>
                <CardContent className="p-6 text-center">
                  <div className="w-16 h-16 mx-auto bg-[#4ECDC4]/20 rounded-full flex items-center justify-center mb-4">
                    <Users className="w-8 h-8 text-[#4ECDC4]" />
                  </div>
                  <h3 className="font-fredoka text-lg text-[#4ECDC4] mb-2">Peer Pods</h3>
                  <p className="text-sm text-gray-600">Connect anonymously with peers facing similar challenges</p>
                </CardContent>
              </Card>
            </div>

            {/* Stats Section */}
            <div className="mt-16 text-center">
              <div className="inline-flex gap-8 bg-white/80 backdrop-blur-sm p-8 rounded-[25px] shadow-[8px_8px_0px_#4ECDC4] animate-fade-in" style={{ animationDelay: '1.6s' }}>
                <div className="text-center">
                  <p className="font-fredoka text-4xl text-[#FF6B6B] mb-1">24/7</p>
                  <p className="text-sm text-gray-600">AI Support</p>
                </div>
                <div className="w-px bg-gray-200"></div>
                <div className="text-center">
                  <p className="font-fredoka text-4xl text-[#4ECDC4] mb-1">100%</p>
                  <p className="text-sm text-gray-600">Private & Safe</p>
                </div>
                <div className="w-px bg-gray-200"></div>
                <div className="text-center">
                  <p className="font-fredoka text-4xl text-[#FFD93D] mb-1">India</p>
                  <p className="text-sm text-gray-600">Culturally Aware</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const renderOnboarding = () => {
    const currentQuestion = onboardingStep < 9
      ? PHQ9_QUESTIONS[onboardingStep]
      : GAD7_QUESTIONS[onboardingStep - 9]

    const currentAnswer = onboardingStep < 9
      ? phq9Answers[onboardingStep]
      : gad7Answers[onboardingStep - 9]

    const totalQuestions = 16
    const progress = (onboardingStep / totalQuestions) * 100

    return (
      <div className="min-h-screen bg-[#F8F8FF] flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl border-0 shadow-[8px_8px_0px_#FF6B6B] rounded-[25px] transition-shadow hover:shadow-[12px_12px_0px_#FF6B6B]">
          <CardHeader>
            <div className="flex items-center gap-2 mb-4">
              {Array.from({ length: totalQuestions }).map((_, i) => (
                <div
                  key={i}
                  className={`h-2 flex-1 rounded-full transition-colors ${
                    i <= onboardingStep ? 'bg-[#FF6B6B]' : 'bg-gray-200'
                  }`}
                />
              ))}
            </div>
            <CardTitle className="font-fredoka text-2xl text-[#FF6B6B] tracking-wider">
              {onboardingStep < 9 ? 'PHQ-9 Assessment' : 'GAD-7 Assessment'}
            </CardTitle>
            <p className="text-sm text-gray-600 mt-2">
              Question {onboardingStep + 1} of {totalQuestions}
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-[#FFD93D]/10 p-6 rounded-[20px] border-2 border-[#FFD93D]">
              <p className="text-lg font-medium">{currentQuestion}</p>
              <p className="text-sm text-gray-600 mt-2">
                Over the last 2 weeks, how often have you been bothered by this?
              </p>
            </div>

            <div className="space-y-3">
              {ANSWER_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleOnboardingAnswer(option.value)}
                  className={`w-full p-4 rounded-[20px] border-2 transition-all ${
                    currentAnswer === option.value
                      ? 'bg-[#4ECDC4] border-[#4ECDC4] text-white shadow-[4px_4px_0px_#FF6B6B]'
                      : 'bg-white border-gray-200 hover:border-[#4ECDC4]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{option.label}</span>
                    {currentAnswer === option.value && <CheckCircle className="w-5 h-5" />}
                  </div>
                </button>
              ))}
            </div>

            <div className="flex gap-3 pt-4">
              {onboardingStep > 0 && (
                <Button
                  onClick={handleOnboardingBack}
                  variant="outline"
                  className="flex-1 rounded-[20px] border-2 border-[#FF6B6B] text-[#FF6B6B] hover:bg-[#FF6B6B] hover:text-white"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              )}
              <Button
                onClick={handleOnboardingNext}
                disabled={!canProceed()}
                className="flex-1 rounded-[20px] bg-[#FF6B6B] hover:bg-[#ff5252] shadow-[4px_4px_0px_#4ECDC4] hover:shadow-[6px_6px_0px_#4ECDC4] transition-all disabled:opacity-50"
              >
                {onboardingStep === 15 ? 'Complete' : 'Next'}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {showConfetti && (
          <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
            <Card className="w-full max-w-md border-0 shadow-[12px_12px_0px_#FFD93D] rounded-[25px]">
              <CardContent className="text-center py-12">
                <div className="text-6xl mb-4">🎉</div>
                <h2 className="font-fredoka text-3xl text-[#FF6B6B] mb-2">Assessment Complete!</h2>
                <p className="text-gray-600 mb-4">
                  PHQ-9: {userData.phq9Score} | GAD-7: {userData.gad7Score}
                </p>
                <p className="text-sm text-gray-500">Taking you to your dashboard...</p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    )
  }

  const renderDashboard = () => {
    return (
      <div className="min-h-screen bg-[#F8F8FF] p-4">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <div className="bg-white p-6 rounded-[25px] shadow-[8px_8px_0px_#FF6B6B]">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="font-fredoka text-3xl text-[#FF6B6B] tracking-wider">
                  Welcome back, {userData.username}! 👋
                </h1>
                <p className="text-gray-600 mt-1">Keep up the amazing work on your wellness journey</p>
              </div>
              <div className="flex gap-4">
                <div className="bg-[#FFD93D]/20 px-6 py-3 rounded-[20px] border-2 border-[#FFD93D] flex items-center gap-2">
                  <Flame className="w-5 h-5 text-[#FF6B6B]" />
                  <div>
                    <p className="text-xs text-gray-600">Streak</p>
                    <p className="font-bold text-lg">{userData.streak} days</p>
                  </div>
                </div>
                <div className="bg-[#4ECDC4]/20 px-6 py-3 rounded-[20px] border-2 border-[#4ECDC4] flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-[#4ECDC4]" />
                  <div>
                    <p className="text-xs text-gray-600">Points</p>
                    <p className="font-bold text-lg">{userData.points}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <button
              onClick={() => setCurrentScreen('nirvana')}
              className="bg-gradient-to-br from-[#FF6B6B] to-[#ff5252] p-6 rounded-[25px] shadow-[6px_6px_0px_#4ECDC4] hover:shadow-[8px_8px_0px_#4ECDC4] transition-all text-white text-left"
            >
              <MessageCircle className="w-8 h-8 mb-3" />
              <h3 className="font-fredoka text-xl tracking-wide">Nirvana Chat</h3>
              <p className="text-sm opacity-90 mt-1">Talk to your AI wellness companion</p>
            </button>

            <button
              onClick={() => setCurrentScreen('task')}
              className="bg-gradient-to-br from-[#4ECDC4] to-[#3dbdb4] p-6 rounded-[25px] shadow-[6px_6px_0px_#FFD93D] hover:shadow-[8px_8px_0px_#FFD93D] transition-all text-white text-left"
            >
              <Target className="w-8 h-8 mb-3" />
              <h3 className="font-fredoka text-xl tracking-wide">My Tasks</h3>
              <p className="text-sm opacity-90 mt-1">Personalized wellness activities</p>
            </button>

            <button
              onClick={() => setCurrentScreen('race')}
              className="bg-gradient-to-br from-[#FFD93D] to-[#ffc93d] p-6 rounded-[25px] shadow-[6px_6px_0px_#FF6B6B] hover:shadow-[8px_8px_0px_#FF6B6B] transition-all text-gray-800 text-left"
            >
              <Zap className="w-8 h-8 mb-3" />
              <h3 className="font-fredoka text-xl tracking-wide">Soul Sprints</h3>
              <p className="text-sm opacity-90 mt-1">Join wellness challenges</p>
            </button>

            <button
              onClick={() => setCurrentScreen('pod')}
              className="bg-gradient-to-br from-purple-500 to-purple-600 p-6 rounded-[25px] shadow-[6px_6px_0px_#4ECDC4] hover:shadow-[8px_8px_0px_#4ECDC4] transition-all text-white text-left"
            >
              <Users className="w-8 h-8 mb-3" />
              <h3 className="font-fredoka text-xl tracking-wide">Peer Pods</h3>
              <p className="text-sm opacity-90 mt-1">Connect with others anonymously</p>
            </button>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-0 shadow-[6px_6px_0px_#FF6B6B] rounded-[25px]">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Tasks Completed</p>
                    <p className="font-fredoka text-3xl text-[#FF6B6B] mt-1">{userData.completedTasks.length}</p>
                  </div>
                  <CheckCircle className="w-12 h-12 text-[#4ECDC4]" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-[6px_6px_0px_#4ECDC4] rounded-[25px]">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Active Challenges</p>
                    <p className="font-fredoka text-3xl text-[#4ECDC4] mt-1">{userData.activeChallenges.length}</p>
                  </div>
                  <Zap className="w-12 h-12 text-[#FFD93D]" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-[6px_6px_0px_#FFD93D] rounded-[25px]">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Your Level</p>
                    <p className="font-fredoka text-3xl text-[#FFD93D] mt-1">{userData.level}</p>
                  </div>
                  <Award className="w-12 h-12 text-[#FF6B6B]" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Leaderboard Preview */}
          <Card className="border-0 shadow-[8px_8px_0px_#4ECDC4] rounded-[25px]">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="font-fredoka text-2xl text-[#FF6B6B] tracking-wider">
                  Top Contributors
                </CardTitle>
                <Button
                  onClick={() => setCurrentScreen('leaderboard')}
                  variant="outline"
                  className="rounded-[20px] border-2 border-[#4ECDC4]"
                >
                  View All
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 justify-center mb-6">
                {leaderboard.slice(0, 3).map((user, idx) => (
                  <div
                    key={user.rank}
                    className={`flex flex-col items-center ${
                      idx === 0 ? 'order-2' : idx === 1 ? 'order-1' : 'order-3'
                    }`}
                  >
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-2 ${
                      idx === 0 ? 'bg-[#FFD93D] text-2xl' : idx === 1 ? 'bg-gray-300 text-xl' : 'bg-[#CD7F32] text-xl'
                    }`}>
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}
                    </div>
                    <p className="font-medium text-sm">{user.username}</p>
                    <p className="text-xs text-gray-600">{user.points} pts</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const renderNirvana = () => {
    return (
      <div className="min-h-screen bg-[#F8F8FF] flex flex-col">
        {/* Header */}
        <div className="bg-white p-4 shadow-md">
          <div className="max-w-4xl mx-auto flex items-center gap-4">
            <Button
              onClick={() => setCurrentScreen('dashboard')}
              variant="ghost"
              className="rounded-[20px]"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-fredoka text-2xl text-[#FF6B6B] tracking-wider">Nirvana Chat</h1>
              <p className="text-sm text-gray-600">Your AI wellness companion</p>
            </div>
          </div>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-4xl mx-auto space-y-4">
            {chatMessages.length === 0 && (
              <div className="text-center py-12">
                <div className="w-20 h-20 bg-gradient-to-br from-[#FF6B6B] to-[#4ECDC4] rounded-full mx-auto mb-4 flex items-center justify-center text-3xl">
                  🧘
                </div>
                <h2 className="font-fredoka text-2xl text-[#FF6B6B] mb-2">Hi! I'm Nirvana</h2>
                <p className="text-gray-600">How are you feeling today?</p>

                <div className="flex flex-wrap gap-2 justify-center mt-6">
                  {['I\'m feeling stressed', 'Struggling with studies', 'Need motivation', 'Feeling anxious'].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => setChatInput(suggestion)}
                      className="px-4 py-2 rounded-[20px] bg-[#4ECDC4]/20 border-2 border-[#4ECDC4] text-sm hover:bg-[#4ECDC4] hover:text-white transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {chatMessages.map((message, idx) => (
              <div
                key={idx}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] p-4 rounded-[20px] ${
                    message.role === 'user'
                      ? 'bg-[#FF6B6B] text-white shadow-[4px_4px_0px_#4ECDC4]'
                      : 'bg-white shadow-[4px_4px_0px_#FFD93D] border-2 border-gray-100'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                  {message.crisis && (
                    <div className="mt-3 p-3 bg-red-100 border-2 border-red-500 rounded-[15px]">
                      <p className="text-sm text-red-800 font-medium">
                        🆘 If you're in crisis, please reach out: National Suicide Prevention Lifeline: 1-800-273-8255
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {chatLoading && (
              <div className="flex justify-start">
                <div className="bg-white p-4 rounded-[20px] shadow-[4px_4px_0px_#FFD93D]">
                  <Loader2 className="w-5 h-5 animate-spin text-[#4ECDC4]" />
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>
        </div>

        {/* Input */}
        <div className="bg-white p-4 shadow-lg">
          <div className="max-w-4xl mx-auto flex gap-2">
            <Input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Type your message..."
              className="rounded-[20px] border-2 border-gray-200 focus:border-[#4ECDC4]"
            />
            <Button
              onClick={handleSendMessage}
              disabled={chatLoading || !chatInput.trim()}
              className="rounded-[20px] bg-[#FF6B6B] hover:bg-[#ff5252] shadow-[4px_4px_0px_#4ECDC4]"
            >
              <Send className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* ElevenLabs Voice Widget */}
        <div className="fixed bottom-4 right-4 z-50">
          <elevenlabs-convai agent-id="agent_4601k53mbg0eebg82j06yprcshc8"></elevenlabs-convai>
        </div>
      </div>
    )
  }

  const renderTasks = () => {
    return (
      <div className="min-h-screen bg-[#F8F8FF] p-4">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Button
              onClick={() => setCurrentScreen('dashboard')}
              variant="ghost"
              className="rounded-[20px]"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-fredoka text-3xl text-[#FF6B6B] tracking-wider">My Tasks</h1>
              <p className="text-gray-600">Personalized wellness activities</p>
            </div>
          </div>

          {/* Get Tasks Button */}
          {tasks.length === 0 && (
            <Card className="border-0 shadow-[8px_8px_0px_#4ECDC4] rounded-[25px]">
              <CardContent className="text-center py-12">
                <Target className="w-16 h-16 mx-auto mb-4 text-[#4ECDC4]" />
                <h2 className="font-fredoka text-2xl text-[#FF6B6B] mb-2">Ready for your tasks?</h2>
                <p className="text-gray-600 mb-6">Get personalized wellness tasks based on your profile</p>
                <Button
                  onClick={handleGetTasks}
                  disabled={taskLoading}
                  className="rounded-[20px] bg-[#4ECDC4] hover:bg-[#3dbdb4] shadow-[4px_4px_0px_#FF6B6B] px-8"
                >
                  {taskLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Getting Tasks...
                    </>
                  ) : (
                    'Get Recommended Tasks'
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Task List */}
          {tasks.length > 0 && !selectedTask && (
            <div className="space-y-4">
              {tasks.map((task, idx) => (
                <Card
                  key={idx}
                  className="border-0 shadow-[6px_6px_0px_#FF6B6B] rounded-[25px] hover:shadow-[8px_8px_0px_#FF6B6B] transition-all cursor-pointer"
                  onClick={() => setSelectedTask(task)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-fredoka text-xl text-[#FF6B6B]">{task.task_title}</h3>
                          <span className={`px-3 py-1 rounded-[15px] text-xs font-medium ${
                            task.difficulty === 'easy' ? 'bg-green-100 text-green-800' :
                            task.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {task.difficulty}
                          </span>
                        </div>
                        <p className="text-gray-600 mb-3">{task.task_description}</p>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {task.estimated_time}
                          </span>
                          <span className="flex items-center gap-1">
                            <Trophy className="w-4 h-4 text-[#FFD93D]" />
                            {task.points_value} points
                          </span>
                          <span className="px-2 py-1 bg-[#4ECDC4]/20 rounded-[10px] text-[#4ECDC4]">
                            {task.category}
                          </span>
                        </div>
                      </div>
                      <ArrowRight className="w-6 h-6 text-[#4ECDC4]" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Task Detail */}
          {selectedTask && (
            <Card className="border-0 shadow-[8px_8px_0px_#4ECDC4] rounded-[25px]">
              <CardHeader>
                <Button
                  onClick={() => setSelectedTask(null)}
                  variant="ghost"
                  className="w-fit rounded-[20px] mb-2"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Tasks
                </Button>
                <CardTitle className="font-fredoka text-2xl text-[#FF6B6B] tracking-wider">
                  {selectedTask.task_title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-[#FFD93D]/10 p-6 rounded-[20px] border-2 border-[#FFD93D]">
                  <h4 className="font-medium mb-2">Instructions</h4>
                  <p className="text-gray-700">{selectedTask.task_description}</p>
                </div>

                <div className="bg-[#4ECDC4]/10 p-6 rounded-[20px] border-2 border-[#4ECDC4]">
                  <h4 className="font-medium mb-2">Expected Benefit</h4>
                  <p className="text-gray-700">{selectedTask.expected_benefit}</p>
                </div>

                <div className="bg-[#FF6B6B]/10 p-6 rounded-[20px] border-2 border-[#FF6B6B]">
                  <h4 className="font-medium mb-2">Why this task?</h4>
                  <p className="text-gray-700">{selectedTask.personalization_reason}</p>
                </div>

                {/* Image Upload */}
                <div className="border-2 border-dashed border-gray-300 rounded-[20px] p-8 text-center">
                  {!imagePreview ? (
                    <>
                      <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                      <p className="text-gray-600 mb-4">Upload proof of completion</p>
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden"
                        />
                        <span className="px-6 py-3 bg-[#4ECDC4] text-white rounded-[20px] inline-block hover:bg-[#3dbdb4] transition-colors">
                          Choose Image
                        </span>
                      </label>
                    </>
                  ) : (
                    <div className="space-y-4">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="max-w-full h-auto max-h-64 mx-auto rounded-[20px]"
                      />
                      <div className="flex gap-2 justify-center">
                        <Button
                          onClick={() => {
                            setUploadedImage(null)
                            setImagePreview(null)
                          }}
                          variant="outline"
                          className="rounded-[20px]"
                        >
                          <X className="w-4 h-4 mr-2" />
                          Remove
                        </Button>
                        <Button
                          onClick={handleSubmitProof}
                          disabled={submitting}
                          className="rounded-[20px] bg-[#FF6B6B] hover:bg-[#ff5252] shadow-[4px_4px_0px_#4ECDC4]"
                        >
                          {submitting ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Verifying...
                            </>
                          ) : (
                            <>
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Submit Proof
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Success Animation */}
          {taskSuccess.show && (
            <div className="fixed inset-0 flex items-center justify-center bg-black/60 z-50 backdrop-blur-sm">
              <Card className="w-full max-w-md border-0 shadow-[16px_16px_0px_#FFD93D] rounded-[25px] bg-white animate-bounce-in">
                <CardContent className="text-center py-12 px-8">
                  <div className="relative mb-6">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-32 h-32 bg-[#FFD93D]/20 rounded-full animate-ping"></div>
                    </div>
                    <div className="relative flex items-center justify-center">
                      <CheckCircle className="w-24 h-24 text-[#4ECDC4]" />
                    </div>
                  </div>
                  <h2 className="font-fredoka text-4xl text-[#4ECDC4] mb-4 tracking-wider">Task Completed!</h2>
                  <div className="bg-gradient-to-r from-[#FF6B6B] to-[#4ECDC4] rounded-[20px] p-6 mb-4">
                    <div className="text-6xl font-fredoka text-white mb-2">
                      +{taskSuccess.points}
                    </div>
                    <p className="text-white text-lg font-medium">Points Earned</p>
                  </div>
                  <p className="text-gray-600 text-lg mb-6">{taskSuccess.message}</p>
                  <div className="flex items-center justify-center gap-4 text-sm">
                    <div className="flex items-center gap-2 bg-[#FFD93D]/20 px-4 py-2 rounded-[15px]">
                      <Trophy className="w-4 h-4 text-[#FF6B6B]" />
                      <span className="font-medium">Total: {userData.points} pts</span>
                    </div>
                    <div className="flex items-center gap-2 bg-[#4ECDC4]/20 px-4 py-2 rounded-[15px]">
                      <Award className="w-4 h-4 text-[#4ECDC4]" />
                      <span className="font-medium">Level {userData.level}</span>
                    </div>
                  </div>
                  <Button
                    onClick={() => {
                      setTaskSuccess({ show: false, points: 0, message: '' })
                      setSelectedTask(null)
                      setUploadedImage(null)
                      setImagePreview(null)
                    }}
                    className="mt-6 rounded-[20px] bg-[#FF6B6B] hover:bg-[#ff5252] shadow-[4px_4px_0px_#4ECDC4] px-8 py-3 text-lg"
                  >
                    Awesome!
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    )
  }

  const renderRace = () => {
    return (
      <div className="min-h-screen bg-[#F8F8FF] p-4">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Button
              onClick={() => setCurrentScreen('dashboard')}
              variant="ghost"
              className="rounded-[20px]"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-fredoka text-3xl text-[#FF6B6B] tracking-wider">Soul Sprints</h1>
              <p className="text-gray-600">Join wellness challenges and compete with others</p>
            </div>
          </div>

          {/* Active Challenges */}
          <div>
            <h2 className="font-fredoka text-xl text-[#4ECDC4] mb-4 tracking-wide">Active Challenges</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {challenges.map((challenge) => (
                <Card
                  key={challenge.id}
                  className="border-0 shadow-[6px_6px_0px_#FF6B6B] rounded-[25px] hover:shadow-[8px_8px_0px_#FF6B6B] transition-all"
                >
                  <CardContent className="p-6 space-y-4">
                    <div>
                      <h3 className="font-fredoka text-lg text-[#FF6B6B] mb-2">{challenge.name}</h3>
                      <p className="text-sm text-gray-600">{challenge.description}</p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1 text-gray-600">
                          <Trophy className="w-4 h-4 text-[#FFD93D]" />
                          {challenge.points} points
                        </span>
                        <span className="flex items-center gap-1 text-gray-600">
                          <Users className="w-4 h-4 text-[#4ECDC4]" />
                          {challenge.participants} joined
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1 text-gray-600">
                          <Clock className="w-4 h-4" />
                          {challenge.duration}
                        </span>
                        <span className="text-[#FF6B6B] font-medium">
                          Ends {new Date(challenge.deadline).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {challenge.active ? (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Progress</span>
                          <span className="font-medium">{challenge.progress}%</span>
                        </div>
                        <Progress value={challenge.progress} className="h-2" />
                      </div>
                    ) : (
                      <Button
                        onClick={() => {
                          setChallenges(prev => prev.map(c =>
                            c.id === challenge.id
                              ? { ...c, active: true, participants: c.participants + 1 }
                              : c
                          ))
                          setUserData(prev => ({
                            ...prev,
                            activeChallenges: [...prev.activeChallenges, challenge.id]
                          }))
                        }}
                        className="w-full rounded-[20px] bg-[#4ECDC4] hover:bg-[#3dbdb4] shadow-[4px_4px_0px_#FFD93D]"
                      >
                        Join Challenge
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* My Active Challenges */}
          {userData.activeChallenges.length > 0 && (
            <div>
              <h2 className="font-fredoka text-xl text-[#4ECDC4] mb-4 tracking-wide">My Active Challenges</h2>
              <div className="grid grid-cols-1 gap-4">
                {challenges
                  .filter(c => c.active)
                  .map((challenge) => (
                    <Card
                      key={challenge.id}
                      className="border-0 shadow-[6px_6px_0px_#4ECDC4] rounded-[25px]"
                    >
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h3 className="font-fredoka text-lg text-[#FF6B6B]">{challenge.name}</h3>
                            <p className="text-sm text-gray-600">{challenge.description}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-fredoka text-[#FFD93D]">{challenge.progress}%</p>
                            <p className="text-xs text-gray-600">Complete</p>
                          </div>
                        </div>
                        <Progress value={challenge.progress} className="h-3" />
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  const renderPod = () => {
    return (
      <div className="min-h-screen bg-[#F8F8FF] p-4">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Button
              onClick={() => {
                setActivePod(null)
                setCurrentScreen('dashboard')
              }}
              variant="ghost"
              className="rounded-[20px]"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-fredoka text-3xl text-[#FF6B6B] tracking-wider">Peer Pods</h1>
              <p className="text-gray-600">Connect with others in a safe, anonymous space</p>
            </div>
          </div>

          {/* Safety Banner */}
          <Card className="border-0 bg-purple-50 border-2 border-purple-200 rounded-[25px]">
            <CardContent className="p-4 flex items-start gap-3">
              <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white flex-shrink-0">
                ℹ️
              </div>
              <div>
                <p className="font-medium text-purple-900">Community Guidelines</p>
                <p className="text-sm text-purple-700">Be respectful, supportive, and kind. All conversations are moderated for safety.</p>
              </div>
            </CardContent>
          </Card>

          {!activePod ? (
            /* Pod List */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pods.map((pod) => (
                <Card
                  key={pod.id}
                  className="border-0 shadow-[6px_6px_0px_#FF6B6B] rounded-[25px] hover:shadow-[8px_8px_0px_#FF6B6B] transition-all cursor-pointer"
                  onClick={() => setActivePod(pod)}
                >
                  <CardContent className="p-6 space-y-4">
                    <div>
                      <h3 className="font-fredoka text-lg text-[#FF6B6B] mb-1">{pod.name}</h3>
                      <p className="text-sm text-gray-600">{pod.topic}</p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {pod.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-3 py-1 bg-[#4ECDC4]/20 text-[#4ECDC4] text-xs rounded-[15px]"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t">
                      <span className="flex items-center gap-1 text-sm text-gray-600">
                        <Users className="w-4 h-4" />
                        {pod.participants} members
                      </span>
                      <Button
                        size="sm"
                        className="rounded-[15px] bg-purple-500 hover:bg-purple-600"
                      >
                        Join
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            /* Pod Chat */
            <div className="grid grid-cols-1 gap-6">
              <Card className="border-0 shadow-[8px_8px_0px_#4ECDC4] rounded-[25px]">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="font-fredoka text-2xl text-[#FF6B6B] tracking-wider">
                        {activePod.name}
                      </CardTitle>
                      <p className="text-sm text-gray-600 mt-1">
                        {activePod.participants} members • {activePod.topic}
                      </p>
                    </div>
                    <Button
                      onClick={() => setActivePod(null)}
                      variant="outline"
                      className="rounded-[20px]"
                    >
                      Leave Pod
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Messages */}
                  <div className="min-h-[400px] max-h-[500px] overflow-y-auto space-y-3 p-4 bg-gray-50 rounded-[20px]">
                    {activePod.messages.length === 0 ? (
                      <div className="text-center py-12 text-gray-500">
                        <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>No messages yet. Start the conversation!</p>
                      </div>
                    ) : (
                      activePod.messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`p-3 rounded-[15px] ${
                            msg.flagged
                              ? 'bg-red-100 border-2 border-red-500'
                              : 'bg-white'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-sm text-purple-600">
                              {msg.username}
                            </span>
                            <span className="text-xs text-gray-500">
                              {new Date(msg.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          <p className="text-gray-700">{msg.content}</p>
                          {msg.flagged && (
                            <p className="text-xs text-red-700 mt-2">
                              ⚠️ This message has been flagged for moderator review
                            </p>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  {/* Input */}
                  <div className="flex gap-2">
                    <Textarea
                      value={podInput}
                      onChange={(e) => setPodInput(e.target.value)}
                      placeholder="Share your thoughts (anonymously)..."
                      className="rounded-[20px] border-2 border-gray-200 resize-none"
                      rows={2}
                    />
                    <Button
                      onClick={handleSendPodMessage}
                      disabled={!podInput.trim()}
                      className="rounded-[20px] bg-purple-500 hover:bg-purple-600"
                    >
                      <Send className="w-5 h-5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    )
  }

  const renderLeaderboard = () => {
    return (
      <div className="min-h-screen bg-[#F8F8FF] p-4">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Button
              onClick={() => setCurrentScreen('dashboard')}
              variant="ghost"
              className="rounded-[20px]"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-fredoka text-3xl text-[#FF6B6B] tracking-wider">Leaderboard</h1>
              <p className="text-gray-600">Top wellness contributors</p>
            </div>
          </div>

          {/* Podium */}
          <Card className="border-0 shadow-[8px_8px_0px_#FFD93D] rounded-[25px]">
            <CardContent className="p-8">
              <div className="flex gap-4 justify-center items-end">
                {/* Second Place */}
                <div className="flex flex-col items-center">
                  <div className="w-20 h-20 rounded-full bg-gray-300 flex items-center justify-center text-3xl mb-2">
                    🥈
                  </div>
                  <p className="font-fredoka text-lg mb-1">{leaderboard[1].username}</p>
                  <p className="text-sm text-gray-600">{leaderboard[1].points} pts</p>
                  <div className="w-24 bg-gray-300 h-20 rounded-t-[20px] mt-4 flex items-center justify-center text-2xl font-fredoka">
                    2
                  </div>
                </div>

                {/* First Place */}
                <div className="flex flex-col items-center">
                  <div className="w-24 h-24 rounded-full bg-[#FFD93D] flex items-center justify-center text-4xl mb-2 shadow-lg">
                    🥇
                  </div>
                  <p className="font-fredoka text-xl mb-1">{leaderboard[0].username}</p>
                  <p className="text-sm text-gray-600">{leaderboard[0].points} pts</p>
                  <div className="w-28 bg-[#FFD93D] h-28 rounded-t-[20px] mt-4 flex items-center justify-center text-3xl font-fredoka shadow-lg">
                    1
                  </div>
                </div>

                {/* Third Place */}
                <div className="flex flex-col items-center">
                  <div className="w-20 h-20 rounded-full bg-[#CD7F32] flex items-center justify-center text-3xl mb-2">
                    🥉
                  </div>
                  <p className="font-fredoka text-lg mb-1">{leaderboard[2].username}</p>
                  <p className="text-sm text-gray-600">{leaderboard[2].points} pts</p>
                  <div className="w-24 bg-[#CD7F32] h-16 rounded-t-[20px] mt-4 flex items-center justify-center text-2xl font-fredoka">
                    3
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Rankings */}
          <Card className="border-0 shadow-[8px_8px_0px_#4ECDC4] rounded-[25px]">
            <CardContent className="p-6">
              <div className="space-y-2">
                {leaderboard.slice(3).map((user) => (
                  <div
                    key={user.rank}
                    className="flex items-center justify-between p-4 bg-white rounded-[20px] border-2 border-gray-100 hover:border-[#4ECDC4] transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-[#4ECDC4]/20 rounded-full flex items-center justify-center font-fredoka text-lg text-[#4ECDC4]">
                        {user.rank}
                      </div>
                      <div>
                        <p className="font-medium">{user.username}</p>
                        <p className="text-sm text-gray-600">{user.badges} badges earned</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-fredoka text-xl text-[#FF6B6B]">{user.points}</p>
                      <p className="text-xs text-gray-600">points</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Your Rank */}
          <Card className="border-0 shadow-[8px_8px_0px_#FF6B6B] rounded-[25px] sticky bottom-4">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-[#FF6B6B] to-[#4ECDC4] rounded-full flex items-center justify-center font-fredoka text-lg text-white">
                    ?
                  </div>
                  <div>
                    <p className="font-medium">{userData.username} (You)</p>
                    <p className="text-sm text-gray-600">Keep earning points to rank!</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-fredoka text-2xl text-[#FF6B6B]">{userData.points}</p>
                  <p className="text-xs text-gray-600">points</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Main render
  if (currentScreen === 'login') return renderLogin()
  if (currentScreen === 'home') return renderHome()
  if (currentScreen === 'onboarding') return renderOnboarding()
  if (currentScreen === 'dashboard') return renderDashboard()
  if (currentScreen === 'nirvana') return renderNirvana()
  if (currentScreen === 'task') return renderTasks()
  if (currentScreen === 'race') return renderRace()
  if (currentScreen === 'pod') return renderPod()
  if (currentScreen === 'leaderboard') return renderLeaderboard()

  return renderHome()
}
