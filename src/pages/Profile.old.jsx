import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { User, Instagram, Save, Trophy, Award, Star, Camera } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

export default function Profile() {
  const [user, setUser] = useState(null);
  const [formData, setFormData] = useState({
    display_name: '',
    bio: '',
    instagram_handle: '',
    followers_count: 0,
    avatar_url: ''
  });
  const [avatarFile, setAvatarFile] = useState(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    const fetchUser = async () => {
      const userData = await base44.auth.me();
      setUser(userData);
      setFormData({
        display_name: userData.display_name || '',
        bio: userData.bio || '',
        instagram_handle: userData.instagram_handle || '',
        followers_count: userData.followers_count || 0,
        avatar_url: userData.avatar_url || ''
      });
    };
    fetchUser();
  }, []);

  const updateProfileMutation = useMutation({
    mutationFn: (data) => base44.auth.updateMe(data),
    onSuccess: async () => {
      const updatedUser = await base44.auth.me();
      setUser(updatedUser);
      setFormData({
        display_name: updatedUser.display_name || '',
        bio: updatedUser.bio || '',
        instagram_handle: updatedUser.instagram_handle || '',
        followers_count: updatedUser.followers_count || 0,
        avatar_url: updatedUser.avatar_url || ''
      });
      queryClient.invalidateQueries({ queryKey: ['current-user'] });
      alert('Perfil atualizado com sucesso! ✅');
      setAvatarFile(null);
    }
  });

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setAvatarFile(file);
    setIsUploadingAvatar(true);

    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFormData({ ...formData, avatar_url: file_url });
      setIsUploadingAvatar(false);
    } catch (error) {
      alert('Erro ao fazer upload da imagem');
      setIsUploadingAvatar(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    updateProfileMutation.mutate(formData);
  };

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">Meu Perfil

          </h1>
          <p className="text-gray-600 mt-2">Gerencie suas informações como Ecoante</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <Card className="shadow-lg border-emerald-100 bg-white/80 backdrop-blur-sm">
            <CardHeader className="text-center border-b border-emerald-100">
              <div className="relative w-24 h-24 mx-auto mb-4">
                {formData.avatar_url ?
                <img
                  src={formData.avatar_url}
                  alt={user?.full_name}
                  className="w-24 h-24 rounded-full object-cover shadow-lg border-4 border-white" /> :


                <div className="w-24 h-24 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center shadow-lg">
                    <span className="text-white text-4xl font-bold">
                      {(formData.display_name?.charAt(0) || user?.full_name?.charAt(0) || 'E').toUpperCase()}
                    </span>
                  </div>
                }
                <label
                  htmlFor="avatar-upload"
                  className="absolute bottom-0 right-0 bg-emerald-600 hover:bg-emerald-700 text-white p-2 rounded-full cursor-pointer shadow-lg transition-all duration-200">

                  <Camera className="w-4 h-4" />
                  <input
                    id="avatar-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden" />

                </label>
              </div>
              {isUploadingAvatar &&
              <p className="text-sm text-emerald-600 mb-2">Enviando imagem...</p>
              }
              <CardTitle className="text-xl">{formData.display_name || user?.full_name || 'Ecoante'}</CardTitle>
              <p className="text-sm text-gray-500">{user?.email}</p>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-yellow-600" />
                    <span className="text-sm font-medium">Categoria</span>
                  </div>
                  <span className="font-bold text-yellow-700">
                    {user?.current_category?.replace(/_/g, ' ') || 'Voz e Violão'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Star className="w-5 h-5 text-purple-600" />
                    <span className="text-sm font-medium">Pontos</span>
                  </div>
                  <span className="font-bold text-purple-700">{user?.total_points || 0}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-green-600" />
                    <span className="text-sm font-medium">Ganhos</span>
                  </div>
                  <span className="font-bold text-green-700">R$ {(user?.total_earnings || 0).toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2 shadow-lg border-emerald-100 bg-white/80 backdrop-blur-sm">
            <CardHeader className="border-b border-emerald-100">
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5 text-emerald-600" />
                Informações do Ecoante
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="display_name">Nome de Exibição</Label>
                    <Input
                      id="display_name"
                      placeholder="Seu nome ou apelido"
                      value={formData.display_name}
                      onChange={(e) => setFormData({ ...formData, display_name: e.target.value })} />

                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={user?.email || ''}
                      disabled
                      className="bg-gray-50" />

                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">Biografia</Label>
                  <Textarea
                    id="bio"
                    placeholder="Conte um pouco sobre você e seu trabalho com sustentabilidade..."
                    value={formData.bio}
                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                    className="h-24" />

                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="instagram_handle" className="flex items-center gap-2">
                      <Instagram className="w-4 h-4 text-pink-500" />
                      Instagram
                    </Label>
                    <Input
                      id="instagram_handle"
                      placeholder="@seuusuario"
                      value={formData.instagram_handle}
                      onChange={(e) => setFormData({ ...formData, instagram_handle: e.target.value })} />

                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="followers_count">Número de Seguidores</Label>
                    <Input
                      id="followers_count"
                      type="number"
                      min="0"
                      placeholder="0"
                      value={formData.followers_count}
                      onChange={(e) => setFormData({ ...formData, followers_count: parseInt(e.target.value) || 0 })} />

                  </div>
                </div>



                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
                  disabled={updateProfileMutation.isPending || isUploadingAvatar}>

                  <Save className="w-4 h-4 mr-2" />
                  {updateProfileMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>);

}