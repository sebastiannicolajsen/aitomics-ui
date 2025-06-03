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
  Badge,
} from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import UpdateIcon from '@mui/icons-material/Update';
import CloseIcon from '@mui/icons-material/Close';
import DownloadIcon from '@mui/icons-material/Download';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LaunchIcon from '@mui/icons-material/Launch';
import DOMPurify from 'dompurify';
import { VersionInfo as VersionInfoType, UpdateInfo, UpdateProgress } from '../types/electron';

const RELEASES_URL = 'https://github.com/sebastiannicolajsen/aitomics-ui/releases';

const ReleaseNotes: React.FC<{ notes: string }> = ({ notes }) => {
  // Clean up the release notes before sanitizing
  const cleanNotes = notes
    // Remove empty list items
    .replace(/<li>\s*<p>\s*<\/p>\s*<\/li>/g, '')
    // Remove empty paragraphs
    .replace(/<p>\s*<\/p>/g, '')
    // Clean up extra whitespace
    .replace(/\s+/g, ' ')
    .trim();

  // Log the input and cleaned notes for debugging
  console.log('Original notes:', notes);
  console.log('Cleaned notes:', cleanNotes);

  const sanitizedHTML = DOMPurify.sanitize(cleanNotes, {
    ALLOWED_TAGS: ['ul', 'li', 'p', 'a', 'tt'],
    ALLOWED_ATTR: ['href', 'class', 'data-hovercard-type', 'data-hovercard-url'],
    ALLOW_DATA_ATTR: true, // Allow data attributes
    ADD_ATTR: ['target'], // Allow target attribute for links
    ADD_TAGS: ['tt'], // Ensure tt tag is allowed
  });

  // Log the sanitized HTML for debugging
  console.log('Sanitized HTML:', sanitizedHTML);

  // Create a temporary div to parse the HTML and ensure it's valid
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = sanitizedHTML;
  const parsedHTML = tempDiv.innerHTML;
  console.log('Parsed HTML:', parsedHTML);

  return (
    <Box sx={{ 
      '& ul': {
        listStyle: 'disc',
        pl: 2,
        mb: 0,
        mt: 0,
      },
      '& li': {
        mb: 1,
        '&:last-child': {
          mb: 0,
        },
        '& p': {
          m: 0,
          fontSize: '0.875rem',
          lineHeight: 1.5,
          color: 'text.primary',
        },
      },
      '& a': {
        color: 'primary.main',
        textDecoration: 'none',
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          textDecoration: 'underline',
          color: 'primary.dark',
        },
      },
      '& tt': {
        fontFamily: 'monospace',
        fontSize: '0.85em',
        background: 'rgba(0, 0, 0, 0.04)',
        padding: '0.1em 0.3em',
        borderRadius: '3px',
        color: 'text.secondary',
      },
    }}>
      <div dangerouslySetInnerHTML={{ __html: parsedHTML }} />
    </Box>
  );
};

const VersionInfo: React.FC = () => {
  const [versionInfo, setVersionInfo] = useState<VersionInfoType | null>(null);
  const [isInfoDialogOpen, setIsInfoDialogOpen] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<string>('not-available');
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
      <Box 
        onClick={() => setIsInfoDialogOpen(true)}
        sx={{ 
          display: 'flex', 
          flexDirection: 'column',
          gap: 0.5,
          background: 'linear-gradient(145deg, #ffffff 0%, #f8f8f9 100%)',
          borderRadius: '8px',
          p: 0.75,
          border: '1px solid rgba(0, 0, 0, 0.06)',
          transition: 'all 0.2s ease-in-out',
          cursor: 'pointer',
          '&:hover': {
            background: 'linear-gradient(145deg, #f8f8f9 0%, #f0f0f1 100%)',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
          }
        }}
      >
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1,
        }}>
          <Box sx={{ 
            display: 'flex',
            alignItems: 'center',
            color: updateStatus === 'available' ? 'primary.main' : 'text.secondary',
            transition: 'all 0.2s ease-in-out',
          }}>
            {updateStatus === 'available' ? (
              <UpdateIcon sx={{ fontSize: '1rem' }} />
            ) : (
              <InfoIcon sx={{ fontSize: '1rem' }} />
            )}
          </Box>
          <Typography variant="caption" sx={{ 
            color: updateStatus === 'available' ? 'primary.main' : 'text.secondary',
            fontWeight: 500,
            fontSize: '0.75rem',
          }}>
            v{versionInfo?.appVersion}
            {updateStatus === 'available' && updateInfo && (
              <> → v{updateInfo.version}</>
            )}
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
        </Box>
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
            Version Information
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
          <Stack spacing={2}>
            <Box sx={{ 
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              background: 'linear-gradient(145deg, #ffffff 0%, #f8f8f9 100%)',
              borderRadius: '8px',
              p: 1.5,
              border: '1px solid rgba(0, 0, 0, 0.06)',
            }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle2" sx={{ 
                  color: 'text.secondary',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  mb: 0.5,
                }}>
                  Current Version
                </Typography>
                <Typography variant="body1" sx={{ 
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: 'text.primary',
                }}>
                  v{versionInfo?.appVersion}
                  {versionInfo?.appVersion && isBetaVersion(versionInfo.appVersion) && (
                    <Chip
                      size="small"
                      label="BETA"
                      sx={{
                        ml: 1,
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
                </Typography>
              </Box>
              {updateStatus === 'available' && updateInfo ? (
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle2" sx={{ 
                    color: 'text.secondary',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    mb: 0.5,
                  }}>
                    Latest Version
                  </Typography>
                  <Typography variant="body1" sx={{ 
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    color: 'primary.main',
                  }}>
                    v{updateInfo.version}
                  </Typography>
                </Box>
              ) : (
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle2" sx={{ 
                    color: 'text.secondary',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    mb: 0.5,
                  }}>
                    Aitomics Version
                  </Typography>
                  <Typography variant="body1" sx={{ 
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    color: 'text.primary',
                  }}>
                    v{versionInfo?.aitomicsVersion}
                  </Typography>
                </Box>
              )}
            </Box>

            {updateStatus === 'available' && updateInfo?.releaseNotes && (
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
                <ReleaseNotes notes={updateInfo.releaseNotes} />
              </Box>
            )}

            {updateStatus === 'available' && (
              <Button
                variant="contained"
                startIcon={<LaunchIcon />}
                component={Link}
                href={RELEASES_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => window.electron?.ipcRenderer.invoke('open-external-link', RELEASES_URL)}
                sx={{ 
                  alignSelf: 'flex-start',
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
            )}
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
                  <ReleaseNotes notes={updateInfo.releaseNotes} />
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
                  <ReleaseNotes notes={updateInfo.releaseNotes} />
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