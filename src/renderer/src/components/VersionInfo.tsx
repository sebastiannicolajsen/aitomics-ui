import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  LinearProgress,
  Stack,
  Chip,
  Link,
} from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import UpdateIcon from '@mui/icons-material/Update';
import CloseIcon from '@mui/icons-material/Close';
import DownloadIcon from '@mui/icons-material/Download';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LaunchIcon from '@mui/icons-material/Launch';
import { VersionInfo as VersionInfoType, UpdateInfo, UpdateProgress } from '../types/electron';

const RELEASES_URL = 'https://github.com/sebastiannicolajsen/aitomics-ui/releases';

const VersionInfo: React.FC = () => {
  const [versionInfo, setVersionInfo] = useState<VersionInfoType | null>(null);
  const [isInfoDialogOpen, setIsInfoDialogOpen] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<string>('');
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [updateProgress, setUpdateProgress] = useState<UpdateProgress | null>(null);
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);

  useEffect(() => {
    // Get version info
    window.electron?.getVersionInfo().then(setVersionInfo);

    // Listen for update status
    window.electron?.onUpdateStatus((status, info) => {
      setUpdateStatus(status);
      if (status === 'available' && info) {
        setUpdateInfo(info as UpdateInfo);
        setIsUpdateDialogOpen(true);
      } else if (status === 'downloading' && info) {
        setUpdateProgress(info as UpdateProgress);
      } else if (status === 'downloaded') {
        setUpdateProgress(null);
        setIsUpdateDialogOpen(true);
      }
    });
  }, []);

  const handleCheckForUpdates = () => {
    window.electron?.checkForUpdates();
  };

  const handleDownloadUpdate = () => {
    window.electron?.downloadUpdate();
  };

  const handleInstallUpdate = () => {
    window.electron?.installUpdate();
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const isBetaVersion = (version: string) => version.includes('-beta.');

  return (
    <>
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 1,
        background: 'linear-gradient(145deg, #ffffff 0%, #f8f8f9 100%)',
        borderRadius: '8px',
        p: 0.75,
        border: '1px solid rgba(0, 0, 0, 0.06)',
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          background: 'linear-gradient(145deg, #f8f8f9 0%, #f0f0f1 100%)',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
        }
      }}>
        <Tooltip title="App Information">
          <IconButton
            size="small"
            onClick={() => setIsInfoDialogOpen(true)}
            sx={{
              color: 'text.secondary',
              transition: 'all 0.2s ease-in-out',
              p: 0.5,
              '&:hover': {
                color: 'primary.main',
                background: 'rgba(16, 163, 127, 0.08)',
              },
            }}
          >
            <InfoIcon sx={{ fontSize: '1rem' }} />
          </IconButton>
        </Tooltip>
        <Typography variant="caption" sx={{ 
          color: 'text.secondary',
          fontWeight: 500,
          fontSize: '0.75rem',
          px: 0.5,
        }}>
          v{versionInfo?.appVersion}
        </Typography>
        {versionInfo?.appVersion && isBetaVersion(versionInfo.appVersion) && (
          <Chip
            size="small"
            label="BETA"
            sx={{
              height: '18px',
              fontSize: '0.65rem',
              fontWeight: 600,
              background: 'linear-gradient(145deg, #fff3cd 0%, #ffe69c 100%)',
              color: '#856404',
              border: '1px solid rgba(255, 193, 7, 0.2)',
              borderRadius: '4px',
              '& .MuiChip-label': {
                px: 0.75,
                py: 0.25,
              },
            }}
          />
        )}
        <Box sx={{ 
          width: '1px', 
          height: '16px', 
          background: 'rgba(0, 0, 0, 0.08)',
          mx: 0.5,
        }} />
        <Typography variant="caption" sx={{ 
          color: 'text.secondary',
          fontWeight: 500,
          fontSize: '0.75rem',
        }}>
          Aitomics v{versionInfo?.aitomicsVersion}
        </Typography>
        <Tooltip title="Check for Updates">
          <IconButton
            size="small"
            onClick={handleCheckForUpdates}
            sx={{
              color: 'text.secondary',
              transition: 'all 0.2s ease-in-out',
              p: 0.5,
              ml: 0.5,
              '&:hover': {
                color: 'primary.main',
                background: 'rgba(16, 163, 127, 0.08)',
              },
            }}
          >
            <UpdateIcon sx={{ fontSize: '1rem' }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* App Info Dialog */}
      <Dialog
        open={isInfoDialogOpen}
        onClose={() => setIsInfoDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '12px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
            background: 'linear-gradient(145deg, #ffffff 0%, #f8f8f9 100%)',
            border: '1px solid rgba(0, 0, 0, 0.06)',
          },
        }}
      >
        <DialogTitle sx={{ 
          borderBottom: '1px solid',
          borderColor: 'divider',
          pb: 2,
          pt: 2.5,
          px: 3,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <Typography variant="h6" sx={{ 
            fontSize: '1.1rem',
            fontWeight: 600,
            color: 'text.primary',
          }}>
            Application Information
          </Typography>
          <IconButton
            onClick={() => setIsInfoDialogOpen(false)}
            size="small"
            sx={{
              color: 'text.secondary',
              transition: 'all 0.2s ease-in-out',
              p: 0.5,
              '&:hover': {
                color: 'primary.main',
                background: 'rgba(16, 163, 127, 0.08)',
              },
            }}
          >
            <CloseIcon sx={{ fontSize: '1.1rem' }} />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ px: 3, py: 2.5 }}>
          <Stack spacing={2.5}>
            <Box sx={{ mt: 1 }}>
              <Typography variant="subtitle2" sx={{ 
                color: 'text.secondary',
                fontSize: '0.75rem',
                fontWeight: 600,
                mb: 1,
              }}>
                Application Version
              </Typography>
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 1,
                background: 'linear-gradient(145deg, #ffffff 0%, #f8f8f9 100%)',
                borderRadius: '8px',
                p: 1.5,
                border: '1px solid rgba(0, 0, 0, 0.06)',
              }}>
                <Typography variant="body1" sx={{ 
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: 'text.primary',
                }}>
                  {versionInfo?.appVersion}
                </Typography>
                {versionInfo?.appVersion && isBetaVersion(versionInfo.appVersion) && (
                  <Chip
                    size="small"
                    label="BETA"
                    sx={{
                      height: '20px',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      background: 'linear-gradient(145deg, #fff3cd 0%, #ffe69c 100%)',
                      color: '#856404',
                      border: '1px solid rgba(255, 193, 7, 0.2)',
                      borderRadius: '4px',
                      '& .MuiChip-label': {
                        px: 1,
                      },
                    }}
                  />
                )}
              </Box>
            </Box>
            <Box>
              <Typography variant="subtitle2" sx={{ 
                color: 'text.secondary',
                fontSize: '0.75rem',
                fontWeight: 600,
                mb: 1,
              }}>
                Aitomics Version
              </Typography>
              <Box sx={{ 
                background: 'linear-gradient(145deg, #ffffff 0%, #f8f8f9 100%)',
                borderRadius: '8px',
                p: 1.5,
                border: '1px solid rgba(0, 0, 0, 0.06)',
              }}>
                <Typography variant="body1" sx={{ 
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: 'text.primary',
                }}>
                  {versionInfo?.aitomicsVersion}
                </Typography>
              </Box>
            </Box>
            <Box>
              <Button
                variant="outlined"
                startIcon={<LaunchIcon sx={{ fontSize: '1.1rem' }} />}
                component={Link}
                href={RELEASES_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => window.electron?.ipcRenderer.invoke('open-external-link', RELEASES_URL)}
                sx={{ 
                  mt: 1,
                  borderRadius: '8px',
                  borderColor: 'rgba(16, 163, 127, 0.2)',
                  color: 'primary.main',
                  background: 'linear-gradient(145deg, #ffffff 0%, #f8f8f9 100%)',
                  '&:hover': {
                    background: 'linear-gradient(145deg, #e6f7f1 0%, #d1f0e6 100%)',
                    borderColor: 'primary.main',
                    boxShadow: '0 2px 8px rgba(16, 163, 127, 0.15)',
                  },
                }}
              >
                Download Latest Release
              </Button>
            </Box>
          </Stack>
        </DialogContent>
      </Dialog>

      {/* Update Dialog */}
      <Dialog
        open={isUpdateDialogOpen}
        onClose={() => {
          if (updateStatus !== 'downloading') {
            setIsUpdateDialogOpen(false);
          }
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '12px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
            background: 'linear-gradient(145deg, #ffffff 0%, #f8f8f9 100%)',
            border: '1px solid rgba(0, 0, 0, 0.06)',
          },
        }}
      >
        <DialogTitle sx={{ 
          borderBottom: '1px solid',
          borderColor: 'divider',
          pb: 2,
          pt: 2.5,
          px: 3,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <Typography variant="h6" sx={{ 
            fontSize: '1.1rem',
            fontWeight: 600,
            color: 'text.primary',
          }}>
            {updateStatus === 'downloaded' ? 'Update Ready' : 'Update Available'}
          </Typography>
          {updateStatus !== 'downloading' && (
            <IconButton
              onClick={() => setIsUpdateDialogOpen(false)}
              size="small"
              sx={{
                color: 'text.secondary',
                transition: 'all 0.2s ease-in-out',
                p: 0.5,
                '&:hover': {
                  color: 'primary.main',
                  background: 'rgba(16, 163, 127, 0.08)',
                },
              }}
            >
              <CloseIcon sx={{ fontSize: '1.1rem' }} />
            </IconButton>
          )}
        </DialogTitle>
        <DialogContent sx={{ px: 3, py: 2.5 }}>
          {updateStatus === 'downloading' ? (
            <Stack spacing={2}>
              <Typography variant="body1" sx={{ 
                fontSize: '0.875rem',
                fontWeight: 500,
                color: 'text.primary',
              }}>
                Downloading update...
              </Typography>
              {updateProgress && (
                <>
                  <Box sx={{ 
                    background: 'linear-gradient(145deg, #ffffff 0%, #f8f8f9 100%)',
                    borderRadius: '8px',
                    p: 1.5,
                    border: '1px solid rgba(0, 0, 0, 0.06)',
                  }}>
                    <LinearProgress 
                      variant="determinate" 
                      value={updateProgress.percent} 
                      sx={{ 
                        height: 6, 
                        borderRadius: 3,
                        backgroundColor: 'rgba(16, 163, 127, 0.08)',
                        '& .MuiLinearProgress-bar': {
                          background: 'linear-gradient(90deg, #10a37f 0%, #0d8c6d 100%)',
                          borderRadius: 3,
                        },
                      }}
                    />
                    <Stack direction="row" spacing={2} justifyContent="space-between" sx={{ mt: 1 }}>
                      <Typography variant="caption" sx={{ 
                        color: 'text.secondary',
                        fontSize: '0.75rem',
                      }}>
                        {formatBytes(updateProgress.transferred)} / {formatBytes(updateProgress.total)}
                      </Typography>
                      <Typography variant="caption" sx={{ 
                        color: 'text.secondary',
                        fontSize: '0.75rem',
                      }}>
                        {formatBytes(updateProgress.bytesPerSecond)}/s
                      </Typography>
                    </Stack>
                  </Box>
                </>
              )}
            </Stack>
          ) : updateStatus === 'downloaded' ? (
            <Stack spacing={2}>
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 1, 
                color: 'success.main',
                background: 'linear-gradient(145deg, #d4edda 0%, #c3e6cb 100%)',
                borderRadius: '8px',
                p: 1.5,
                border: '1px solid rgba(40, 167, 69, 0.2)',
              }}>
                <CheckCircleIcon sx={{ fontSize: '1.2rem' }} />
                <Typography variant="body1" sx={{ 
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: '#155724',
                }}>
                  Update downloaded successfully
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ 
                color: 'text.secondary',
                fontSize: '0.875rem',
              }}>
                A new version ({updateInfo?.version}) is ready to install. Would you like to install it now?
              </Typography>
              {updateInfo?.releaseNotes && (
                <Box sx={{ 
                  mt: 1,
                  background: 'linear-gradient(145deg, #ffffff 0%, #f8f8f9 100%)',
                  borderRadius: '8px',
                  p: 1.5,
                  border: '1px solid rgba(0, 0, 0, 0.06)',
                }}>
                  <Typography variant="subtitle2" sx={{ 
                    color: 'text.secondary',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    mb: 1,
                  }}>
                    Release Notes
                  </Typography>
                  <Typography variant="body2" sx={{ 
                    whiteSpace: 'pre-wrap',
                    fontSize: '0.875rem',
                    color: 'text.primary',
                    lineHeight: 1.5,
                  }}>
                    {updateInfo.releaseNotes}
                  </Typography>
                </Box>
              )}
            </Stack>
          ) : (
            <Stack spacing={2}>
              <Typography variant="body1" sx={{ 
                fontSize: '0.875rem',
                fontWeight: 500,
                color: 'text.primary',
              }}>
                A new version ({updateInfo?.version}) is available.
              </Typography>
              {updateInfo?.releaseNotes && (
                <Box sx={{ 
                  background: 'linear-gradient(145deg, #ffffff 0%, #f8f8f9 100%)',
                  borderRadius: '8px',
                  p: 1.5,
                  border: '1px solid rgba(0, 0, 0, 0.06)',
                }}>
                  <Typography variant="subtitle2" sx={{ 
                    color: 'text.secondary',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    mb: 1,
                  }}>
                    Release Notes
                  </Typography>
                  <Typography variant="body2" sx={{ 
                    whiteSpace: 'pre-wrap',
                    fontSize: '0.875rem',
                    color: 'text.primary',
                    lineHeight: 1.5,
                  }}>
                    {updateInfo.releaseNotes}
                  </Typography>
                </Box>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          {updateStatus === 'downloaded' ? (
            <Button
              variant="contained"
              onClick={handleInstallUpdate}
              startIcon={<UpdateIcon sx={{ fontSize: '1.1rem' }} />}
              sx={{ 
                borderRadius: '8px',
                background: 'linear-gradient(145deg, #10a37f 0%, #0d8c6d 100%)',
                boxShadow: '0 2px 8px rgba(16, 163, 127, 0.2)',
                '&:hover': {
                  background: 'linear-gradient(145deg, #0d8c6d 0%, #0b7a5d 100%)',
                  boxShadow: '0 4px 12px rgba(16, 163, 127, 0.25)',
                },
              }}
            >
              Install Update
            </Button>
          ) : updateStatus === 'available' ? (
            <Button
              variant="contained"
              onClick={handleDownloadUpdate}
              startIcon={<DownloadIcon sx={{ fontSize: '1.1rem' }} />}
              sx={{ 
                borderRadius: '8px',
                background: 'linear-gradient(145deg, #10a37f 0%, #0d8c6d 100%)',
                boxShadow: '0 2px 8px rgba(16, 163, 127, 0.2)',
                '&:hover': {
                  background: 'linear-gradient(145deg, #0d8c6d 0%, #0b7a5d 100%)',
                  boxShadow: '0 4px 12px rgba(16, 163, 127, 0.25)',
                },
              }}
            >
              Download Update
            </Button>
          ) : null}
        </DialogActions>
      </Dialog>
    </>
  );
};

export default VersionInfo; 