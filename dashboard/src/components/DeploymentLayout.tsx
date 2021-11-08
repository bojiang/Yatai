import { resourceIconMapping } from '@/consts'
import { useCluster } from '@/hooks/useCluster'
import { useDeployment, useDeploymentLoading } from '@/hooks/useDeployment'
import { useFetchDeploymentSnapshots } from '@/hooks/useFetchDeploymentSnapshots'
import { useFetchYataiComponents } from '@/hooks/useFetchYataiComponents'
import { useOrganization } from '@/hooks/useOrganization'
import { usePage } from '@/hooks/usePage'
import { useSubscription } from '@/hooks/useSubscription'
import useTranslation from '@/hooks/useTranslation'
import { IDeploymentFullSchema, IDeploymentSchema, IUpdateDeploymentSchema } from '@/schemas/deployment'
import { fetchDeployment, updateDeployment } from '@/services/deployment'
import { Button } from 'baseui/button'
import { Modal, ModalBody, ModalHeader } from 'baseui/modal'
import _ from 'lodash'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { AiOutlineDashboard } from 'react-icons/ai'
import { FaJournalWhills } from 'react-icons/fa'
import { RiSurveyLine } from 'react-icons/ri'
import { VscServerProcess } from 'react-icons/vsc'
import { useQuery, useQueryClient } from 'react-query'
import { useParams } from 'react-router-dom'
import { INavItem } from './BaseSidebar'
import BaseSubLayout from './BaseSubLayout'
import Card from './Card'
import DeploymentForm from './DeploymentForm'
import DeploymentStatusTag from './DeploymentStatusTag'

export interface IDeploymentLayoutProps {
    children: React.ReactNode
}

export default function DeploymentLayout({ children }: IDeploymentLayoutProps) {
    const { clusterName, deploymentName } = useParams<{ clusterName: string; deploymentName: string }>()
    const queryKey = `fetchDeployment:${clusterName}:${deploymentName}`
    const deploymentInfo = useQuery(queryKey, () => fetchDeployment(clusterName, deploymentName))
    const { deployment, setDeployment } = useDeployment()
    const { organization, setOrganization } = useOrganization()
    const { cluster, setCluster } = useCluster()
    const { setDeploymentLoading } = useDeploymentLoading()
    useEffect(() => {
        setDeploymentLoading(deploymentInfo.isLoading)
        if (deploymentInfo.isSuccess) {
            if (!_.isEqual(deployment, deploymentInfo.data)) {
                setDeployment(deploymentInfo.data)
            }
            if (deploymentInfo.data.cluster?.uid !== cluster?.uid) {
                setCluster(deploymentInfo.data.cluster)
            }
            if (deploymentInfo.data.cluster?.organization?.uid !== organization?.uid) {
                setOrganization(deploymentInfo.data.cluster?.organization)
            }
        } else if (deploymentInfo.isLoading) {
            setDeployment(undefined)
        }
    }, [
        cluster?.uid,
        deployment,
        deployment?.uid,
        deploymentInfo.data,
        deploymentInfo.isLoading,
        deploymentInfo.isSuccess,
        organization?.uid,
        setCluster,
        setDeployment,
        setDeploymentLoading,
        setOrganization,
    ])

    const uids = useMemo(() => (deploymentInfo.data?.uid ? [deploymentInfo.data.uid] : []), [deploymentInfo.data?.uid])
    const queryClient = useQueryClient()
    const subscribeCb = useCallback(
        (deployment_: IDeploymentSchema) => {
            queryClient.setQueryData(queryKey, (oldData?: IDeploymentFullSchema): IDeploymentFullSchema => {
                if (oldData && oldData.uid !== deployment_.uid) {
                    return oldData
                }
                return { ...oldData, ...deployment_ }
            })
        },
        [queryClient, queryKey]
    )
    const { subscribe, unsubscribe } = useSubscription()

    useEffect(() => {
        subscribe({
            resourceType: 'deployment',
            resourceUids: uids,
            cb: subscribeCb,
        })
        return () => {
            unsubscribe({
                resourceType: 'deployment',
                resourceUids: uids,
                cb: subscribeCb,
            })
        }
    }, [subscribe, subscribeCb, uids, unsubscribe])

    const [t] = useTranslation()

    const { yataiComponentsInfo } = useFetchYataiComponents(clusterName)
    const hasLogging = yataiComponentsInfo.data?.find((x) => x.type === 'logging') !== undefined
    const hasMonitoring = yataiComponentsInfo.data?.find((x) => x.type === 'monitoring') !== undefined

    const [page] = usePage()
    const { deploymentSnapshotsInfo } = useFetchDeploymentSnapshots(clusterName, deploymentName, page)
    const [isCreateDeploymentSnapshotOpen, setIsCreateDeploymentSnapshotOpen] = useState(false)
    const handleCreateDeploymentSnapshot = useCallback(
        async (data: IUpdateDeploymentSchema) => {
            await updateDeployment(clusterName, deploymentName, data)
            await deploymentInfo.refetch()
            await deploymentSnapshotsInfo.refetch()
            setIsCreateDeploymentSnapshotOpen(false)
        },
        [clusterName, deploymentName, deploymentInfo, deploymentSnapshotsInfo]
    )

    const breadcrumbItems: INavItem[] = useMemo(
        () => [
            {
                title: t('sth list', [t('cluster')]),
                path: '/clusters',
                icon: resourceIconMapping.cluster,
            },
            {
                title: clusterName,
                path: `/clusters/${clusterName}`,
            },
            {
                title: t('sth list', [t('deployment')]),
                path: `/clusters/${clusterName}/deployments`,
                icon: resourceIconMapping.deployment,
            },
            {
                title: deploymentName,
                path: `/clusters/${clusterName}/deployments/${deploymentName}`,
            },
        ],
        [clusterName, deploymentName, t]
    )

    const navItems: INavItem[] = useMemo(
        () =>
            [
                {
                    title: t('overview'),
                    path: `/clusters/${clusterName}/deployments/${deploymentName}`,
                    icon: RiSurveyLine,
                },
                {
                    title: t('replicas'),
                    path: `/clusters/${clusterName}/deployments/${deploymentName}/replicas`,
                    icon: VscServerProcess,
                },
                {
                    title: t('view log'),
                    path: `/clusters/${clusterName}/deployments/${deploymentName}/log`,
                    icon: FaJournalWhills,
                    disabled: !hasLogging,
                    helpMessage: !hasLogging ? t('please install yatai component first', [t('logging')]) : undefined,
                },
                {
                    title: t('monitor'),
                    path: `/clusters/${clusterName}/deployments/${deploymentName}/monitor`,
                    icon: AiOutlineDashboard,
                    disabled: !hasMonitoring,
                    helpMessage: !hasMonitoring
                        ? t('please install yatai component first', [t('monitoring')])
                        : undefined,
                },
                {
                    title: t('sth list', [t('snapshot')]),
                    path: `/clusters/${clusterName}/deployments/${deploymentName}/snapshots`,
                    icon: resourceIconMapping.deployment_snapshot,
                },
            ] as INavItem[],
        [clusterName, deploymentName, hasLogging, hasMonitoring, t]
    )

    return (
        <BaseSubLayout
            header={
                <Card>
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                        }}
                    >
                        <div
                            style={{
                                flexShrink: 0,
                                display: 'flex',
                                alignItems: 'center',
                                fontSize: '18px',
                                gap: 10,
                            }}
                        >
                            {React.createElement(resourceIconMapping.deployment, { size: 14 })}
                            <div>{deploymentName}</div>
                        </div>
                        <div
                            style={{
                                flexGrow: 1,
                            }}
                        />
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 20,
                            }}
                        >
                            <DeploymentStatusTag status={deployment?.status ?? 'unknown'} />
                            <Button onClick={() => setIsCreateDeploymentSnapshotOpen(true)} size='compact'>
                                {t('update')}
                            </Button>
                        </div>
                    </div>
                    <Modal
                        isOpen={isCreateDeploymentSnapshotOpen}
                        onClose={() => setIsCreateDeploymentSnapshotOpen(false)}
                        closeable
                        animate
                        autoFocus
                    >
                        <ModalHeader>{t('update sth', [t('deployment')])}</ModalHeader>
                        <ModalBody>
                            <DeploymentForm
                                clusterName={clusterName}
                                deployment={deployment}
                                deploymentSnapshot={deployment?.latest_snapshot}
                                onSubmit={handleCreateDeploymentSnapshot}
                            />
                        </ModalBody>
                    </Modal>
                </Card>
            }
            breadcrumbItems={breadcrumbItems}
            navItems={navItems}
        >
            {children}
        </BaseSubLayout>
    )
}
